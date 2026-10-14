import { HttpError, json, sha256 } from '../http.ts';
import { connection, configured } from './env.ts';
import type { QbEnv } from './env.ts';
import { canonical, verifyWebhook } from './webhook.ts';

const BATCH_SIZE = 100;

export async function webhook(request: Request, env: QbEnv): Promise<Response> {
  configured(env);
  if(!env.QB_WEBHOOK_VERIFIER)throw new HttpError(503,'WEBHOOK_NOT_CONFIGURED','Webhook verifier is not configured.');
  if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  let dispositions;
  try { dispositions=await verifyWebhook(request,env.QB_WEBHOOK_VERIFIER); }
  catch(error) {
    if(error instanceof HttpError)throw error;
    // Fixed category only: never log the body, headers, signature or realm.
    // Parser messages can quote body bytes, so map to a fixed allowlist.
    const message=error instanceof Error?error.message:'';
    const reason=['invalid_signature','invalid_envelope','invalid_webhook'].includes(message)?message:
      error instanceof HttpError?error.code:error instanceof SyntaxError||error instanceof TypeError?'invalid_body':'unknown';
    console.warn(JSON.stringify({event:'quickbooks_webhook_rejected',reason}));
    return json({error:'INVALID_WEBHOOK'},400);
  }
  const c=await connection(env);
  const counts: Record<string,number>={};
  const statements: D1PreparedStatement[]=[];
  for(const d of dispositions) {
    const event=d.kind==='accepted'?d.event:null;
    // Accepted keys/digests are unchanged from earlier releases so redelivery of
    // stored events still deduplicates. Rejected rows are keyed by their own bytes.
    const digest=event?await sha256(canonical(d)):d.kind==='rejected'?d.fingerprint:'';
    const key=event
      ?await sha256(JSON.stringify(['sandbox',env.QB_CLIENT_ID,event.source,event.id,event.intuitaccountid,null,null]))
      :await sha256(JSON.stringify(['sandbox',env.QB_CLIENT_ID,'rejected',digest]));
    const realm=event?.intuitaccountid ?? (d.kind==='rejected'?d.realmId:null);
    const active=event && event.intuitaccountid===env.QB_REALM_ID && c.realm_id===env.QB_REALM_ID &&
      ['active','refresh_prepared','refresh_dispatched'].includes(c.state) && !c.paused;
    const type=event?.type.split('.') ?? [];
    const reason=active?null:(d.kind==='rejected'?d.reason:'unauthorized_company');
    const label=active?'pending':reason!;
    counts[label]=(counts[label]??0)+1;
    statements.push(env.DB.prepare(`INSERT INTO qb_events(event_key,digest,realm_id,generation,entity_type,entity_id,operation,state,reason,available_at,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(event_key) DO UPDATE SET
      state=CASE WHEN qb_events.digest<>excluded.digest THEN 'conflict' ELSE qb_events.state END,
      reason=CASE WHEN qb_events.digest<>excluded.digest THEN 'digest_conflict' ELSE qb_events.reason END`)
      .bind(key,digest,realm,active?c.generation:null,type[1]??null,event?.intuitentityid??(d.kind==='rejected'?d.entityId:null),type[2]??null,
        active?'pending':'quarantined',reason,Date.now(),Date.now()));
  }
  // Each chunk is atomic; redelivery preserves stored rows and fills missing ones.
  // Never acknowledge a failed D1 write.
  for(let i=0;i<statements.length;i+=BATCH_SIZE)await env.DB.batch(statements.slice(i,i+BATCH_SIZE));
  // Counts by disposition only, so live tails can correlate deliveries safely.
  console.log(JSON.stringify({event:'quickbooks_webhook_received',total:dispositions.length,...counts}));
  return json({received:true});
}
