import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { HttpError } from '../http.ts';
import type { QbEnv } from './env.ts';

const resolvers = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function requireAdmin(request: Request, env: QbEnv, testResolver?: JWTVerifyGetKey, audience = env.ACCESS_AUD): Promise<string> {
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN ?? '') || !audience || !env.ACCESS_ADMIN_SUB) {
    throw new HttpError(503,'ADMIN_NOT_CONFIGURED','Configure Cloudflare Access for operator routes.');
  }
  const issuer = env.ACCESS_TEAM_DOMAIN!;
  let resolver = testResolver ?? resolvers.get(issuer);
  if (!resolver) {
    resolver = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), { timeoutDuration:5000, cacheMaxAge:300000 });
    resolvers.set(issuer, resolver as ReturnType<typeof createRemoteJWKSet>);
  }
  try {
    const { payload } = await jwtVerify(request.headers.get('Cf-Access-Jwt-Assertion') ?? '', resolver, {
      issuer, audience, algorithms:['RS256'], requiredClaims:['sub','exp','iat'], maxTokenAge:'15m', clockTolerance:5
    });
    if (payload.sub !== env.ACCESS_ADMIN_SUB) throw new Error('wrong_subject');
    return payload.sub;
  } catch { throw new HttpError(403,'ADMIN_REQUIRED','An authorized operator session is required.'); }
}
export function sameOrigin(request: Request, env: QbEnv): void {
  if (request.method !== 'POST' || request.headers.get('Origin') !== env.PUBLIC_ORIGIN) {
    throw new HttpError(403,'INVALID_ORIGIN','Use the operator page to perform this action.');
  }
}
export function session(request: Request): string {
  const value = request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('__Host-qb-session='))?.slice(18) ?? '';
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}
export function html(body: string, headers: HeadersInit = {}): Response {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Fox QuickBooks sandbox</title><body><header><img src="/fox-logo.png" alt="Fox Auto Services" width="144" height="144"></header><main>${body}</main></body></html>`, {
    // no-referrer makes native form POSTs send Origin: null. Keep same-origin
    // form provenance while suppressing cross-origin referrers; OAuth redirect
    // responses below and in oauth.ts still use no-referrer to protect codes.
    headers:{ 'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'same-origin',
      'Content-Security-Policy':"default-src 'none'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff',...headers }
  });
}
export const escapeHtml = (v: string) => v.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const cleanRedirect = (env: QbEnv) => new Response(null,{ status:303,headers:{ Location:`${env.PUBLIC_ORIGIN}/api/quickbooks/status`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer' } });
