import type { QbEnv } from './env.ts';

export interface TokenPair { access_token: string; refresh_token: string; expires_at: number; refresh_expires_at: number }
export const base64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
export const randomSecret = (): string => base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const context = (env: QbEnv, generation: number, version: number) => new TextEncoder().encode(
  JSON.stringify(['fox-referrals','sandbox',env.QB_CLIENT_ID,env.QB_REALM_ID,generation,version,'tokens-v1'])
);
async function key(env: QbEnv) {
  const raw = Uint8Array.from(atob(env.QB_TOKEN_KEY ?? ''), c => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error('invalid_token_key');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
}
export async function seal(env: QbEnv, generation: number, version: number, tokens: TokenPair): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name:'AES-GCM', iv, additionalData:context(env,generation,version) }, await key(env), new TextEncoder().encode(JSON.stringify(tokens)));
  return JSON.stringify({ v:1, iv:base64(iv), data:base64(new Uint8Array(ciphertext)) });
}
export async function unseal(env: QbEnv, generation: number, version: number, envelope: string): Promise<TokenPair> {
  const data = JSON.parse(envelope);
  if (data.v !== 1 || typeof data.iv !== 'string' || typeof data.data !== 'string') throw new Error('invalid_envelope');
  const bytes = await crypto.subtle.decrypt({ name:'AES-GCM',
    iv:Uint8Array.from(atob(data.iv), c=>c.charCodeAt(0)), additionalData:context(env,generation,version)
  }, await key(env), Uint8Array.from(atob(data.data), c=>c.charCodeAt(0)));
  return JSON.parse(new TextDecoder().decode(bytes)) as TokenPair;
}
