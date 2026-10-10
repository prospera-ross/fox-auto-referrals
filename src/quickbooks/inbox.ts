import { HttpError, json, sha256 } from '../http.ts';
import { connection, configured } from './env.ts';
import type { QbEnv } from './env.ts';
import { verifyWebhook } from './webhook.ts';

function canonical(value: unknown): string {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value && typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function webhook(request: Request, env: QbEnv): Promise<Response> {
  configured(env);
  if(!env.QB_WEBHOOK_VERIFIER)throw new HttpError(503,'WEBHOOK_NOT_CONFIGURED','Webhook verifier is not configured.');
  if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  let dispositions;
  try { dispositions=await verifyWebhook(request,env.QB_WEBHOOK_VERIFIER); }
  catch(error) {
    if(error instanceof HttpError)throw error;
    return json({error:'INVALID_WEBHOOK'},400);
  }
  const c=await connection(env);
  for(const [index,d] of dispositions.entries()) {
    const event=d.kind==='accepted'?d.event:null;
    const digest=await sha256(canonical(d));
    const key=await sha256(JSON.stringify(['sandbox',env.QB_CLIENT_ID,event?.source,event?.id,event?.intuitaccountid,event?null:digest,index && !event?index:null]));
    const active=event && event.intuitaccountid===env.QB_REALM_ID && c.realm_id===env.QB_REALM_ID &&
      ['active','refresh_prepared','refresh_dispatched'].includes(c.state) && !c.paused;
    const type=event?.type.split('.') ?? [];
    await env.DB.prepare(`INSERT INTO qb_events(event_key,digest,realm_id,generation,entity_type,entity_id,operation,state,reason,available_at,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_key) DO UPDATE SET
      state=CASE WHEN qb_events.digest<>excluded.digest THEN 'conflict' ELSE qb_events.state END,
      reason=CASE WHEN qb_events.digest<>excluded.digest THEN 'digest_conflict' ELSE qb_events.reason END`)
      .bind(key,digest,event?.intuitaccountid??null,active?c.generation:null,type[1]??null,event?.intuitentityid??null,type[2]??null,
        active?'pending':'quarantined',active?null:(d.kind==='rejected'?d.reason:'unauthorized_company'),Date.now(),Date.now()).run();
  }
  // Sequential durable inserts tolerate partial failure: redelivery preserves
  // already-accepted rows and fills missing ones. Never acknowledge failed D1.
  return json({received:true});
}
