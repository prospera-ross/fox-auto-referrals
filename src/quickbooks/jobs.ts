import { sha256 } from '../http.ts';
import { audit, connection, configured } from './env.ts';
import type { QbEnv } from './env.ts';
import type { Binding } from './contracts.ts';
import { SandboxReader } from './reader.ts';
import { LocalConversionStore } from './local-store.ts';
import { getAccessToken, revoke } from './tokens.ts';
import type { Fetcher } from './tokens.ts';
import { processInvoice } from './process-invoice.ts';

interface Job {event_key:string;generation:number;realm_id:string;entity_type:string;entity_id:string;operation:string;attempts:number;lease_id:string}
interface JobResult {state:'done'|'quarantined';reason:string}
const RECONCILE_REVISIT_MS=5*60*1000;

async function processJob(job: Job, env: QbEnv, send: Fetcher): Promise<JobResult> {
  const binding: Binding={environment:'sandbox',realmId:job.realm_id,generation:job.generation};
  const reader=new SandboxReader(env,send);
  await reader.assertAuthorized(binding);
  // Intuit's CloudEvent operation is "void". Retain "voided" for older inbox rows.
  if(['deleted','void','voided'].includes(job.operation))return {state:'quarantined',reason:'reversal_review_required'};
  let invoiceIds=[job.entity_id];
  if(job.entity_type==='payment') {
    const payment=await reader.readPayment(binding,job.entity_id);
    invoiceIds=[...new Set(payment.Line.flatMap(line=>line.LinkedTxn.filter(link=>link.TxnType==='Invoice').map(link=>link.TxnId)))];
    if(!invoiceIds.length || invoiceIds.length>20)return {state:'quarantined',reason:'payment_link_review_required'};
  }
  let held=false;
  const outcomes: string[]=[];
  for(const invoiceId of invoiceIds) {
    // Unique ledger + DB authority trigger guard effects even if a worker loses
    // its read-job lease. The lease only fences job completion, not money safety.
    const result=await processInvoice(binding,invoiceId,{qbo:reader,store:new LocalConversionStore(env.DB,binding)});
    if(result==='held')held=true;
    outcomes.push(result);
  }
  if(held)return {state:'quarantined',reason:'evidence_review_required'};
  const priority=['created','duplicate','unpaid','unmatched','ineligible'] as const;
  const selected=priority.find(value=>outcomes.includes(value))??'mixed';
  const reason={created:'conversion_created',duplicate:'conversion_duplicate',unpaid:'invoice_unpaid',
    unmatched:'customer_unmatched',ineligible:'claim_ineligible',mixed:'processed_mixed'}[selected];
  return {state:'done',reason};
}

async function scanPage(env: QbEnv, binding: Binding, send: Fetcher) {
  const startDate=new Date(Date.now()-31*86400000).toISOString().slice(0,10);
  await env.DB.prepare(`INSERT INTO qb_scan(id,generation,start_date,position) VALUES (1,?,?,1)
    ON CONFLICT(id) DO UPDATE SET generation=excluded.generation,start_date=excluded.start_date,position=1 WHERE qb_scan.generation<>excluded.generation`)
    .bind(binding.generation,startDate).run();
  const scan=await env.DB.prepare('SELECT * FROM qb_scan WHERE id=1').first<{generation:number;start_date:string;position:number}>();
  if(!scan || !/^\d{4}-\d{2}-\d{2}$/.test(scan.start_date) || !Number.isSafeInteger(scan.position) || scan.position<1)throw new Error('invalid_scan');
  const reader=new SandboxReader(env,send);
  const query=`SELECT * FROM Invoice WHERE TxnDate >= '${scan.start_date}' STARTPOSITION ${scan.position} MAXRESULTS 50`;
  const response=await reader.read(binding,`query?query=${encodeURIComponent(query)}`);
  const qr=response.QueryResponse as {Invoice?: {Id?:unknown}[]} | undefined;
  if(!qr || typeof qr!=='object' || (qr.Invoice!==undefined && !Array.isArray(qr.Invoice)))throw new Error('invalid_query_response');
  const invoices=qr.Invoice??[];
  if(invoices.length>50)throw new Error('invalid_query_size');
  for(const invoice of invoices) {
    if(typeof invoice.Id!=='string'||!/^\d{1,30}$/.test(invoice.Id))throw new Error('invalid_query_invoice');
    // Revisit mutable outcomes on a bounded cadence; webhook rows remain independent.
    const key=await sha256(JSON.stringify(['scan',binding.realmId,binding.generation,invoice.Id]));
    await env.DB.prepare(`INSERT INTO qb_events(event_key,digest,realm_id,generation,entity_type,entity_id,operation,state,available_at,created_at)
      VALUES (?, ?, ?, ?, 'invoice', ?, 'updated', 'pending', ?, ?)
      ON CONFLICT(event_key) DO UPDATE SET state='pending',attempts=0,available_at=excluded.available_at
      WHERE qb_events.state='done' AND qb_events.reason IN ('invoice_unpaid','customer_unmatched')
        AND qb_events.available_at<=excluded.available_at`).bind(key,key,binding.realmId,binding.generation,invoice.Id,Date.now(),Date.now()).run();
  }
  await env.DB.prepare('UPDATE qb_scan SET position=?,start_date=? WHERE id=1 AND generation=? AND position=?')
    .bind(invoices.length===50?scan.position+50:1,invoices.length===50?scan.start_date:startDate,binding.generation,scan.position).run();
}

export async function runScheduled(env: QbEnv, send: Fetcher = fetch): Promise<void> {
  if(env.QB_ENABLED!=='true')return;
  configured(env);
  const now=Date.now();
  await env.DB.prepare('DELETE FROM qb_oauth_states WHERE expires_at<?').bind(now).run();
  const expired=await env.DB.prepare(`UPDATE qb_connection SET state='refresh_unknown',paused=1
    WHERE state IN ('authorizing','refresh_prepared','refresh_dispatched') AND attempt_deadline<? RETURNING generation`).bind(now).first<{generation:number}>();
  // An interrupted dispatcher leaves no catch-path audit; record the expiry itself.
  if(expired)await audit(env,'refresh_deadline_expired',expired.generation);
  await env.DB.prepare("UPDATE qb_token_attempts SET state='unknown' WHERE state IN ('prepared','dispatched') AND deadline<?").bind(now).run();
  let c=await connection(env);
  if(c.state==='revocation_pending'||(c.state==='pending'&&c.pending_until<now)){await revoke(env,send);return;}
  if(c.state!=='active'||c.paused)return;
  let requests=0;
  const limitedSend: Fetcher=async (input,init)=>{if(++requests>40)throw new Error('read_budget');return send(input,init);};
  await getAccessToken(env,c.generation,limitedSend);
  c=await connection(env);
  if(c.state!=='active'||c.paused)return;
  const jobs=await env.DB.prepare(`SELECT event_key FROM qb_events WHERE
    (state='pending' AND available_at<=?) OR (state='processing' AND lease_until<=?)
    ORDER BY available_at,event_key LIMIT 10`).bind(now,now).all<{event_key:string}>();
  for(const selected of jobs.results) {
    if(requests>30)break;
    const lease=crypto.randomUUID();
    const job=await env.DB.prepare(`UPDATE qb_events SET state='processing',lease_id=?,lease_until=?,attempts=attempts+1
      WHERE event_key=? AND ((state='pending' AND available_at<=?) OR (state='processing' AND lease_until<=?)) RETURNING *`)
      .bind(lease,Date.now()+120000,selected.event_key,now,now).first<Job>();
    if(!job)continue;
    try {
      const result=await processJob(job,env,limitedSend);
      const revisitAt=result.state==='done'&&['invoice_unpaid','customer_unmatched'].includes(result.reason)
        ?Date.now()+RECONCILE_REVISIT_MS:0;
      await env.DB.prepare(`UPDATE qb_events SET state=?,reason=?,available_at=?,lease_id=NULL,lease_until=0
        WHERE event_key=? AND state='processing' AND lease_id=?`)
        .bind(result.state,result.reason,revisitAt,job.event_key,lease).run();
    } catch {
      await env.DB.prepare(`UPDATE qb_events SET state=?,reason='processing_failed',available_at=?,lease_id=NULL,lease_until=0
        WHERE event_key=? AND state='processing' AND lease_id=?`)
        .bind(job.attempts>=8?'quarantined':'pending',Date.now()+Math.min(3600000,30000*2**Math.min(job.attempts-1,7)),job.event_key,lease).run();
    }
  }
  if(requests<39)await scanPage(env,{realmId:c.realm_id,generation:c.generation,environment:'sandbox'},limitedSend);
}
