import { readBody } from '../http.ts';

export interface QboEvent {
  specversion: '1.0'; id: string; source: string; type: string;
  time: string; intuitentityid: string; intuitaccountid: string;
}
export type EventDisposition = { kind: 'accepted'; event: QboEvent } | { kind: 'rejected'; reason: string; index: number };

/** Parser only; inbox.ts durably records every disposition before HTTP 200. */
export async function verifyWebhook(request: Request, verifier: string): Promise<EventDisposition[]> {
  if (!verifier || request.method !== 'POST') throw new Error('invalid_webhook');
  const signature = request.headers.get('intuit-signature') ?? '';
  if (!/^[A-Za-z0-9+/]{43}=$/.test(signature)) throw new Error('invalid_signature');
  const signatureBytes = Uint8Array.from(atob(signature), char => char.charCodeAt(0));
  if (signatureBytes.length !== 32 || btoa(String.fromCharCode(...signatureBytes)) !== signature) throw new Error('invalid_signature');
  const bytes = await readBody(request, 256 * 1024);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(verifier), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  // WebCrypto performs verification without a JavaScript early-exit comparison.
  if (!await crypto.subtle.verify('HMAC', key, signatureBytes, bytes)) throw new Error('invalid_signature');
  const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  if (!Array.isArray(data) || data.length === 0 || data.length > 100) throw new Error('invalid_envelope');
  return data.map((raw: unknown, index): EventDisposition => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { kind: 'rejected', reason: 'invalid_event', index };
    const event = raw as Record<string, unknown>;
    const bounded = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max;
    if (event.specversion !== '1.0' || event.datacontenttype !== 'application/json' ||
      !bounded(event.id, 128) || !bounded(event.source, 256) ||
      typeof event.time !== 'string' || !Number.isFinite(Date.parse(event.time)) ||
      typeof event.intuitentityid !== 'string' || !/^\d{1,30}$/.test(event.intuitentityid) ||
      typeof event.intuitaccountid !== 'string' || !/^\d{1,30}$/.test(event.intuitaccountid)) {
      return { kind: 'rejected', reason: 'invalid_event', index };
    }
    if (typeof event.type !== 'string' || !/^qbo\.(invoice|payment)\.(created|updated|deleted|void)\.v1$/.test(event.type)) {
      return { kind: 'rejected', reason: 'unsupported_event', index };
    }
    return { kind: 'accepted', event: event as unknown as QboEvent };
  });
}
