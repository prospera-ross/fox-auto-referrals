import { HttpError, json, readBody, sha256 } from './http.ts';
import { validateClaim } from './validation.ts';

export const SHOP_GENIE_URL = 'https://booking.shopgenie.io/?shop=fox-auto-services-4101880591&preselect_account=fox-auto-services-4101880316';

export interface Env {
  DB: D1Database;
  APP_ENV: 'local' | 'staging' | 'production';
  PUBLIC_ORIGIN: string;
  CLAIM_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

export async function claim(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const local = env.APP_ENV === 'local' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (!local && (url.protocol !== 'https:' || env.APP_ENV === 'local')) {
    throw new HttpError(503, 'NOT_CONFIGURED', 'This offer is not available yet.');
  }
  // No wildcard CORS. A public claim is not authenticated by Origin; this check
  // prevents cross-site browser submission, not scripted fraud.
  if (request.headers.get('Origin') !== env.PUBLIC_ORIGIN) {
    throw new HttpError(403, 'INVALID_ORIGIN', 'Open the offer page and try again.');
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') {
    throw new HttpError(415, 'INVALID_CONTENT_TYPE', 'Send the form as JSON.');
  }
  if (!local) {
    // Fail closed until an edge rate limiter is actually bound. Never use an
    // unbounded in-memory counter or trust a client-supplied IP through a proxy.
    if (!env.CLAIM_RATE_LIMITER) throw new HttpError(503, 'NOT_CONFIGURED', 'This offer is not available yet.');
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) throw new HttpError(503, 'NOT_CONFIGURED', 'This offer is not available yet.');
    if (!(await env.CLAIM_RATE_LIMITER.limit({ key: ip })).success) {
      throw new HttpError(429, 'RATE_LIMITED', 'Please wait a minute before trying again.');
    }
  }
  const key = request.headers.get('Idempotency-Key');
  if (key !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw new HttpError(400, 'INVALID_REQUEST_KEY', 'Reload the form and try again.');
  }
  let data: unknown;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(await readBody(request, 4096))); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'INVALID_JSON', 'The form could not be read. Try again.');
  }
  const input = validateClaim(data);
  const claimKey = key ?? crypto.randomUUID();
  const digest = await sha256(JSON.stringify(input));
  const existing = await env.DB.prepare('SELECT payload_hash FROM leads WHERE claim_key = ?').bind(claimKey).first<{ payload_hash: string }>();
  if (existing) {
    if (existing.payload_hash !== digest) throw new HttpError(409, 'REQUEST_CONFLICT', 'Your form changed. Submit it again.');
    return json({ success: true, redirect_url: SHOP_GENIE_URL });
  }
  // Resolve the partner and snapshot reward terms in the insert itself.
  await env.DB.prepare(`INSERT INTO leads
    (id, partner_id, customer_name, customer_phone, customer_email, claim_key, payload_hash, payout_type, payout_value_units)
    SELECT ?, id, ?, ?, ?, ?, ?, payout_type, payout_value_units FROM partners
    WHERE referral_code = ? AND active = 1 AND payout_type = 'FIXED'
    ON CONFLICT(claim_key) DO NOTHING`).bind(
    crypto.randomUUID(), input.customer_name, input.customer_phone, input.customer_email,
    claimKey, digest, input.ref
  ).run();
  const saved = await env.DB.prepare('SELECT payload_hash FROM leads WHERE claim_key = ?').bind(claimKey).first<{ payload_hash: string }>();
  if (!saved) throw new HttpError(400, 'INVALID_REFERRAL', 'This offer link is unavailable. Check the QR code on your card.');
  if (saved.payload_hash !== digest) throw new HttpError(409, 'REQUEST_CONFLICT', 'Your form changed. Submit it again.');
  return json({ success: true, redirect_url: SHOP_GENIE_URL });
}
