import { sha256, HttpError } from '../http.ts';
import { connection, configured, audit } from './env.ts';
import type { QbEnv } from './env.ts';
import { randomSecret, seal } from './crypto.ts';
import { requireAdmin, sameOrigin, session, html, escapeHtml, cleanRedirect } from './admin.ts';
import { tokenRequest, revoke, TokenRequestError, probeTokenEndpoint } from './tokens.ts';
import type { Fetcher } from './tokens.ts';
import { providerJson } from './reader.ts';

export async function oauthRoute(request: Request, env: QbEnv, send: Fetcher = fetch,
  authenticate: typeof requireAdmin = requireAdmin): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  try {
    configured(env);
    if (url.origin !== env.PUBLIC_ORIGIN) throw new HttpError(403,'INVALID_ORIGIN','Use the configured application URL.');
    const subject = await authenticate(request,env);
    const browser = session(request);
    if (path.endsWith('/connect') && request.method === 'GET') {
      const nonce = randomSecret();
      return html('<h1>Connect QuickBooks Sandbox</h1><p>Connect the configured Fox Auto Services sandbox company.</p><form method="post"><button>Authorize sandbox company</button></form>', {
        // Browsers also apply form-action to the POST's OAuth redirect chain.
        // Permit Intuit only on the connect page; other admin forms stay self-only.
        'Content-Security-Policy':"default-src 'none'; img-src 'self'; form-action 'self' https://*.intuit.com; base-uri 'none'; frame-ancestors 'none'",
        'Set-Cookie':`__Host-qb-session=${nonce}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=900`
      });
    }
    if (path.endsWith('/connect') && request.method === 'POST') {
      sameOrigin(request,env);
      if (!browser) throw new HttpError(403,'SESSION_REQUIRED','Open the connection page first.');
      const c = await connection(env);
      if (!['empty','revoked'].includes(c.state)) throw new HttpError(409,'CONNECTION_EXISTS','Review or disconnect the existing connection first.');
      const state = randomSecret();
      await env.DB.prepare('INSERT INTO qb_oauth_states(state_hash,subject,session_hash,expires_at,realm_id,redirect_uri) VALUES (?,?,?,?,?,?)')
        .bind(await sha256(state),subject,await sha256(browser),Date.now()+600000,env.QB_REALM_ID!,env.QB_REDIRECT_URI!).run();
      const target = new URL('https://appcenter.intuit.com/connect/oauth2');
      target.search = new URLSearchParams({ client_id:env.QB_CLIENT_ID!,response_type:'code',
        scope:'com.intuit.quickbooks.accounting',redirect_uri:env.QB_REDIRECT_URI!,state }).toString();
      return new Response(null,{status:303,headers:{Location:target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }
    if (path.endsWith('/callback') && request.method === 'GET') {
      const state = url.searchParams.get('state') ?? '';
      if (!browser || !/^[A-Za-z0-9_-]{43}$/.test(state) || url.searchParams.getAll('state').length !== 1) throw new Error('invalid_state');
      const consumed = await env.DB.prepare(`DELETE FROM qb_oauth_states WHERE state_hash=? AND subject=? AND session_hash=?
        AND expires_at>? AND realm_id=? AND redirect_uri=? RETURNING state_hash`)
        .bind(await sha256(state),subject,await sha256(browser),Date.now(),env.QB_REALM_ID!,env.QB_REDIRECT_URI!).first();
      if (!consumed) throw new Error('invalid_state');
      if (url.searchParams.has('error')) return cleanRedirect(env);
      const code = url.searchParams.get('code');
      if (!code || code.length > 2048 || /[\u0000-\u0020\u007f]/.test(code) || url.searchParams.getAll('code').length !== 1 ||
          url.searchParams.getAll('realmId').length !== 1 || url.searchParams.get('realmId') !== env.QB_REALM_ID) throw new Error('invalid_callback');
      const attempt = crypto.randomUUID();
      const c = await env.DB.prepare(`UPDATE qb_connection SET state='authorizing',realm_id=?,generation=generation+1,
        attempt_id=?,attempt_deadline=?,paused=1,owner_sub=?,session_hash=?
        WHERE id=1 AND state IN ('empty','revoked') RETURNING *`)
        .bind(env.QB_REALM_ID!,attempt,Date.now()+30000,subject,await sha256(browser)).first<import('./env.ts').Connection>();
      if (!c) throw new Error('connection_conflict');
      await env.DB.prepare('INSERT INTO qb_token_attempts(id,generation,kind,state,deadline,created_at) VALUES (?,?,?,?,?,?)')
        .bind(attempt,c.generation,'code','dispatched',c.attempt_deadline,Date.now()).run();
      let stage = 'exchange';
      try {
        const pair = await tokenRequest(env,new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:env.QB_REDIRECT_URI!}),send);
        stage = 'encrypt';
        const envelope = await seal(env,c.generation,1,pair);
        stage = 'persist';
        const saved = await env.DB.prepare(`UPDATE qb_connection SET state='pending',token_envelope=?,credential_generation=generation,
          token_version=1,access_expires_at=?,refresh_expires_at=?,pending_until=?,company_name=NULL
          WHERE id=1 AND state='authorizing' AND generation=? AND attempt_id=? AND attempt_deadline>?`)
          .bind(envelope,pair.expires_at,pair.refresh_expires_at,Date.now()+600000,c.generation,attempt,Date.now()).run();
        if (!saved.meta.changes) throw new Error('stale_exchange');
        await env.DB.prepare("UPDATE qb_token_attempts SET state='succeeded' WHERE id=?").bind(attempt).run();
        stage = 'company_read';
        const data = await providerJson(env,`companyinfo/${env.QB_REALM_ID}`,pair.access_token,send);
        stage = 'company_verify';
        const company = data.CompanyInfo as Record<string,unknown> | undefined;
        // CompanyInfo.Id identifies the entity (commonly "1"), not the realm.
        // Realm was checked in the callback and pins the authenticated REST URL.
        if (!company || !/^\d{1,30}$/.test(String(company.Id)) || typeof company.CompanyName !== 'string' || !company.CompanyName.trim()) throw new Error('company_unverified');
        await env.DB.prepare("UPDATE qb_connection SET company_name=? WHERE id=1 AND state='pending' AND generation=?")
          .bind(company.CompanyName.slice(0,200),c.generation).run();
        await audit(env,'oauth_pending_confirmation',c.generation);
      } catch (error) {
        await env.DB.prepare("UPDATE qb_connection SET state='refresh_unknown',paused=1 WHERE id=1 AND state='authorizing' AND generation=?").bind(c.generation).run();
        await env.DB.prepare("UPDATE qb_token_attempts SET state='unknown' WHERE id=? AND state<>'succeeded'").bind(attempt).run();
        await audit(env,`oauth_failed_${stage}${error instanceof TokenRequestError ? `_${error.reason}` : ''}`,c.generation);
        // Pending encrypted grants that cannot be verified are unavailable to jobs;
        // expiry maintenance revokes them instead of activating them silently.
      }
      return cleanRedirect(env);
    }
    if (path.endsWith('/confirm') && request.method === 'POST') {
      sameOrigin(request,env);
      if (!browser) throw new Error('session_required');
      const changed = await env.DB.prepare(`UPDATE qb_connection SET state='active',paused=0,attempt_id=NULL,attempt_deadline=0
        WHERE id=1 AND state='pending' AND pending_until>? AND owner_sub=? AND session_hash=? AND company_name IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM qb_token_attempts WHERE state IN ('prepared','dispatched','unknown'))`)
        .bind(Date.now(),subject,await sha256(browser)).run();
      if (!changed.meta.changes) throw new HttpError(409,'CONFIRMATION_EXPIRED','Reconnect after resolving the pending connection.');
      await audit(env,'company_confirmed',(await connection(env)).generation);
      return cleanRedirect(env);
    }
    if (path.endsWith('/probe') && request.method === 'POST') {
      sameOrigin(request,env);
      const c = await connection(env);
      if (c.state !== 'refresh_unknown' || c.token_envelope || c.token_version !== 0) {
        throw new HttpError(409,'PROBE_NOT_AVAILABLE','Connectivity probe is available only for a failed initial exchange with no saved token.');
      }
      await audit(env,`oauth_probe_${await probeTokenEndpoint(env,send)}`,c.generation);
      return cleanRedirect(env);
    }
    if (['/api/quickbooks/disconnect','/api/quickbooks/pause','/api/quickbooks/resume'].includes(path) && request.method === 'POST') {
      sameOrigin(request,env);
      if (path.endsWith('/disconnect')) await revoke(env,send);
      else {
        await env.DB.prepare("UPDATE qb_connection SET paused=? WHERE id=1 AND state='active'").bind(path.endsWith('/pause') ? 1 : 0).run();
        await audit(env,path.endsWith('/pause')?'paused':'resumed',(await connection(env)).generation);
      }
      return cleanRedirect(env);
    }
    if (path.endsWith('/status') && request.method === 'GET') {
      const c = await connection(env);
      const counts = await env.DB.prepare("SELECT state,count(*) AS n FROM qb_events GROUP BY state").all<{state:string;n:number}>();
      const form = (action: string,label: string) => `<form action="/api/quickbooks/${action}" method="post"><button>${label}</button></form>`;
      const confirm = c.state === 'pending' && c.company_name && browser && c.owner_sub === subject && c.session_hash === await sha256(browser)
        ? `<p>Verify this sandbox company before enabling reads and commission recording.</p>${form('confirm','Confirm sandbox company')}` : '';
      const held = c.state === 'refresh_unknown'
        ? `<p>Authorization could not be completed reliably. Processing is paused. Operator recovery is required before reconnecting; Resume processing cannot clear this hold.</p>${form('probe','Test Intuit connectivity')}` : '';
      const diagnostic = await env.DB.prepare("SELECT action FROM qb_audit WHERE generation=? AND action LIKE 'oauth_probe_%' ORDER BY created_at DESC LIMIT 1").bind(c.generation).first<{action:string}>();
      return html(`<h1>QuickBooks sandbox</h1><p>Status: ${escapeHtml(c.state)}${c.paused?' (paused)':''}</p>
        <p>Company: ${escapeHtml(c.company_name ?? 'Not verified')} (${escapeHtml(c.realm_id)})</p>${confirm}${held}
        ${diagnostic ? `<p>Connectivity diagnostic: ${escapeHtml(diagnostic.action.slice('oauth_probe_'.length))}</p>` : ''}
        <p>Jobs: ${counts.results.map(row=>`${escapeHtml(row.state)}: ${row.n}`).join(', ') || 'none'}</p>
        <p><a href="/api/quickbooks/connect">Connect sandbox company</a></p>
        ${form('pause','Pause processing')}${form('resume','Resume processing')}${form('disconnect','Disconnect and revoke')}`);
    }
    throw new HttpError(405,'METHOD_NOT_ALLOWED','Unsupported operator action.');
  } catch (error) {
    if (path.endsWith('/callback')) return cleanRedirect(env); // strip OAuth code even on failure
    throw error;
  }
}
