import { readBody, sha256 } from '../http.ts';

export interface QboEvent {
  specversion: '1.0'; id: string; source: string; type: string;
  time?: string; intuitentityid: string; intuitaccountid: string;
}
/** A rejected event keeps only syntactically valid routing hints plus a digest of
 * its own bytes, so distinct rejections never collapse and stay diagnosable. */
export type EventDisposition = { kind: 'accepted'; event: QboEvent } |
  { kind: 'rejected'; reason: string; index: number; fingerprint: string; realmId: string | null; entityId: string | null };

// Intuit sets no size/count limit; 2 MB is its suggested server bound. A rejected
// envelope is retried and can delay later deliveries, so stay well above sandbox needs.
export const MAX_WEBHOOK_BYTES = 2 * 1024 * 1024;
export const MAX_WEBHOOK_EVENTS = 1000;

export function canonical(value: unknown): string {
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value && typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
const numericId = (value: unknown): string | null => typeof value === 'string' && /^\d{1,30}$/.test(value) ? value : null;

/** Parser only; inbox.ts durably records every disposition before HTTP 200. */
export async function verifyWebhook(request: Request, verifier: string): Promise<EventDisposition[]> {
  if (!verifier || request.method !== 'POST') throw new Error('invalid_webhook');
  const signature = request.headers.get('intuit-signature') ?? '';
  if (!/^[A-Za-z0-9+/]{43}=$/.test(signature)) throw new Error('invalid_signature');
  const signatureBytes = Uint8Array.from(atob(signature), char => char.charCodeAt(0));
  if (signatureBytes.length !== 32 || btoa(String.fromCharCode(...signatureBytes)) !== signature) throw new Error('invalid_signature');
  const bytes = await readBody(request, MAX_WEBHOOK_BYTES);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(verifier), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  // WebCrypto performs verification without a JavaScript early-exit comparison.
  if (!await crypto.subtle.verify('HMAC', key, signatureBytes, bytes)) throw new Error('invalid_signature');
  const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  if (!Array.isArray(data) || data.length === 0 || data.length > MAX_WEBHOOK_EVENTS) throw new Error('invalid_envelope');
  return Promise.all(data.map(async (raw: unknown, index): Promise<EventDisposition> => {
    const event = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const reject = async (reason: string): Promise<EventDisposition> => ({ kind: 'rejected', reason, index,
      fingerprint: await sha256(canonical(raw)), realmId: numericId(event.intuitaccountid), entityId: numericId(event.intuitentityid) });
    if (raw !== event) return reject('invalid_event');
    const bounded = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max;
    // Only identity/routing fields drive processing; the signature already proves
    // origin. Optional descriptive fields must not silently drop genuine hints.
    if (event.specversion !== '1.0' ||
      (event.datacontenttype !== undefined && event.datacontenttype !== 'application/json') ||
      !bounded(event.id, 128) || !bounded(event.source, 256) ||
      !numericId(event.intuitentityid) || !numericId(event.intuitaccountid)) {
      return reject('invalid_event');
    }
    if (typeof event.type !== 'string' || !/^qbo\.(invoice|payment)\.(created|updated|deleted|void)\.v1$/.test(event.type)) {
      return reject('unsupported_event');
    }
    return { kind: 'accepted', event: event as unknown as QboEvent };
  }));
}
