import { HttpError, readBody } from '../http.ts';
import { configured, connection, audit } from './env.ts';
import type { QbEnv } from './env.ts';
import { seal, unseal } from './crypto.ts';
import type { TokenPair } from './crypto.ts';

export type Fetcher = typeof fetch;
export const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
export const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
export const authHeader = (env: QbEnv) => `Basic ${btoa(`${env.QB_CLIENT_ID}:${env.QB_CLIENT_SECRET}`)}`;
type TokenFailure = 'transport_timeout' | 'transport_type' | 'transport_other' | 'http_3xx' | 'http_400' | 'http_401' | 'http_403' | 'http_429' | 'http_5xx' | 'http_other' | 'body' | 'shape';
// Fixed categories only: provider bodies, exception messages and tokens must never
// be copied into diagnostics. All failures still require uncertainty recovery.
export class TokenRequestError extends Error {
  readonly reason: TokenFailure;
  constructor(reason: TokenFailure) { super(`token_${reason}`); this.reason = reason; }
}
const transportFailure = (error: unknown): TokenFailure => {
  const name = error instanceof Error ? error.name : '';
  if (name === 'TimeoutError' || name === 'AbortError') return 'transport_timeout';
  if (name === 'TypeError') return 'transport_type';
  return 'transport_other';
};
const statusClass = (status: number): string => status === 400 ? '400' : status === 401 ? '401' :
  status === 403 ? '403' : status === 429 ? '429' : status >= 300 && status < 400 ? '3xx' :
  status >= 500 ? '5xx' : 'other';
export async function tokenRequest(env: QbEnv, form: URLSearchParams, send: Fetcher = fetch): Promise<TokenPair> {
  let response: Response;
  try {
    // Workers currently throws a TypeError for this Intuit request when using
    // redirect:'error', even when redirect:'manual' exposes the final 400/200.
    // Manual mode still fails closed: 3xx responses are never followed.
    response = await send(TOKEN_URL, { method:'POST', redirect:'manual', signal:AbortSignal.timeout(15000),
      headers:{ Authorization:authHeader(env),'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json' }, body:form.toString() });
  } catch (error) { throw new TokenRequestError(transportFailure(error)); }
  if (!response.ok) {
    await response.body?.cancel().catch(()=>{});
    const category: TokenFailure = response.status >= 300 && response.status < 400 ? 'http_3xx' : response.status === 400 ? 'http_400' : response.status === 401 ? 'http_401' :
      response.status === 403 ? 'http_403' : response.status === 429 ? 'http_429' : response.status >= 500 ? 'http_5xx' : 'http_other';
    throw new TokenRequestError(category);
  }
  let data;
  try {
    const raw = await readBody(new Request('https://response.invalid', { method:'POST',body:response.body,duplex:'half' } as RequestInit),65536);
    data = JSON.parse(new TextDecoder().decode(raw));
  } catch { throw new TokenRequestError('body'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      typeof data.access_token !== 'string' || !data.access_token || data.access_token.length > 8192 ||
      typeof data.refresh_token !== 'string' || !data.refresh_token || data.refresh_token.length > 8192 ||
      !Number.isFinite(data.expires_in) || data.expires_in <= 0 ||
      !Number.isFinite(data.x_refresh_token_expires_in) || data.x_refresh_token_expires_in <= 0 ||
      String(data.token_type).toLowerCase() !== 'bearer') throw new TokenRequestError('shape');
  return { access_token:data.access_token,refresh_token:data.refresh_token,
    expires_at:Date.now()+data.expires_in*1000,refresh_expires_at:Date.now()+data.x_refresh_token_expires_in*1000 };
}

// Admin-only connectivity probe. Its deliberately invalid code can never complete
// a grant; responses and exception text are discarded and only fixed categories
// are returned. The manual redirect retry distinguishes a redirect rejection from
// a timeout or lower-level network error in the Workers runtime.
export async function probeTokenEndpoint(env: QbEnv, send: Fetcher = fetch): Promise<string> {
  const body = new URLSearchParams({grant_type:'authorization_code',code:'fox-referrals-connectivity-probe-never-issued',redirect_uri:env.QB_REDIRECT_URI!}).toString();
  const headers = {Authorization:authHeader(env),'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'};
  try {
    const response = await send(TOKEN_URL,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers,body});
    await response.body?.cancel().catch(()=>{});
    return `http_${statusClass(response.status)}`;
  } catch (error) {
    const first = transportFailure(error);
    try {
      const response = await send(TOKEN_URL,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers,body});
      await response.body?.cancel().catch(()=>{});
      return `${first}_manual_${statusClass(response.status)}`;
    } catch (manualError) {
      return `${first}_manual_${transportFailure(manualError)}`;
    }
  }
}
export async function getAccessToken(env: QbEnv, generation: number, send: Fetcher = fetch): Promise<string> {
  configured(env);
  const c = await connection(env);
  if (c.realm_id !== env.QB_REALM_ID || c.generation !== generation || c.state !== 'active' || c.paused || !c.token_envelope) throw new Error('connection_inactive');
  const tokens = await unseal(env,c.credential_generation,c.token_version,c.token_envelope);
  if (tokens.expires_at > Date.now()+60000) return tokens.access_token;
  if (tokens.refresh_expires_at <= Date.now()) throw new Error('reconnect_required');
  const attempt = crypto.randomUUID();
  const deadline = Date.now()+30000;
  const changed = await env.DB.prepare(`UPDATE qb_connection SET state='refresh_prepared',attempt_id=?,attempt_deadline=?
    WHERE id=1 AND state='active' AND paused=0 AND generation=? AND token_version=?`).bind(attempt,deadline,generation,c.token_version).run();
  if (!changed.meta.changes) throw new Error('refresh_busy');
  // Persist an attempt before dispatch. Failure leaves a safe non-active hold.
  await env.DB.prepare('INSERT INTO qb_token_attempts(id,generation,kind,state,deadline,created_at) VALUES (?,?,?, ?,?,?)')
    .bind(attempt,generation,'refresh','prepared',deadline,Date.now()).run();
  const dispatched = await env.DB.prepare(`UPDATE qb_connection SET state='refresh_dispatched'
    WHERE id=1 AND state='refresh_prepared' AND generation=? AND attempt_id=? AND attempt_deadline>?`)
    .bind(generation,attempt,Date.now()).run();
  if (!dispatched.meta.changes) throw new Error('refresh_hold');
  await env.DB.prepare("UPDATE qb_token_attempts SET state='dispatched' WHERE id=?").bind(attempt).run();
  try {
    const fresh = await tokenRequest(env,new URLSearchParams({ grant_type:'refresh_token',refresh_token:tokens.refresh_token }),send);
    const encrypted = await seal(env,generation,c.token_version+1,fresh);
    const saved = await env.DB.prepare(`UPDATE qb_connection SET state='active',token_envelope=?,token_version=token_version+1,
      access_expires_at=?,refresh_expires_at=?,attempt_id=NULL,attempt_deadline=0
      WHERE id=1 AND generation=? AND state='refresh_dispatched' AND attempt_id=? AND token_version=? AND attempt_deadline>?`)
      .bind(encrypted,fresh.expires_at,fresh.refresh_expires_at,generation,attempt,c.token_version,Date.now()).run();
    if (!saved.meta.changes) throw new Error('stale_refresh');
    await env.DB.prepare("UPDATE qb_token_attempts SET state='succeeded' WHERE id=?").bind(attempt).run();
    return fresh.access_token;
  } catch (error) {
    await env.DB.prepare("UPDATE qb_connection SET state='refresh_unknown',paused=1 WHERE id=1 AND generation=? AND attempt_id=? AND state='refresh_dispatched'").bind(generation,attempt).run();
    await env.DB.prepare("UPDATE qb_token_attempts SET state='unknown' WHERE id=? AND state<>'succeeded'").bind(attempt).run();
    // Fixed category only, so a later hold can be diagnosed without logs.
    await audit(env,`refresh_failed_${error instanceof TokenRequestError?error.reason:'internal'}`,generation).catch(()=>{});
    throw new HttpError(503,'REFRESH_HELD','Token renewal requires operator recovery.');
  }
}
export async function revoke(env: QbEnv, send: Fetcher = fetch): Promise<void> {
  let c = await connection(env);
  if (['empty','revoked'].includes(c.state)) return;
  // Never reclaim uncertain refresh authority merely because a lease expired.
  await env.DB.prepare(`UPDATE qb_connection SET state='revocation_pending',paused=1,generation=generation+1
    WHERE id=1 AND state NOT IN ('revocation_pending','revoked')`).run();
  c = await connection(env);
  if (!c.token_envelope) throw new Error('revocation_unknown');
  const tokens = await unseal(env,c.credential_generation,c.token_version,c.token_envelope);
  const response = await send(REVOKE_URL,{ method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),
    headers:{ Authorization:authHeader(env),'Content-Type':'application/json',Accept:'application/json' },body:JSON.stringify({ token:tokens.refresh_token }) });
  await response.body?.cancel();
  if (!response.ok) throw new Error('revocation_pending');
  const outstanding = await env.DB.prepare("SELECT id FROM qb_token_attempts WHERE state IN ('prepared','dispatched','unknown') LIMIT 1").first();
  // Confirm revocation without silently resolving a suspended/unknown dispatcher.
  if (outstanding) throw new Error('dispatch_recovery_required');
  await env.DB.prepare("UPDATE qb_connection SET state='revoked',token_envelope=NULL WHERE id=1 AND state='revocation_pending' AND generation=?").bind(c.generation).run();
  await audit(env,'revoked',c.generation);
}
