import type { Env } from '../claim.ts';
import { HttpError } from '../http.ts';

export interface QbEnv extends Env {
  QB_ENABLED?: string;
  QB_CLIENT_ID?: string;
  QB_CLIENT_SECRET?: string;
  QB_TOKEN_KEY?: string;
  QB_WEBHOOK_VERIFIER?: string;
  QB_REALM_ID?: string;
  QB_REDIRECT_URI?: string;
  QB_MINOR_VERSION?: string;
  QB_TIME_ZONE?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ACCESS_ADMIN_SUB?: string;
}
export interface Connection {
  id: number; realm_id: string; generation: number; credential_generation: number;
  token_version: number; state: string; token_envelope: string | null;
  access_expires_at: number; refresh_expires_at: number; attempt_id: string | null;
  attempt_deadline: number; pending_until: number; owner_sub: string | null;
  session_hash: string | null; company_name: string | null; paused: number;
}
export function configured(env: QbEnv): void {
  if (env.QB_ENABLED !== 'true' || env.APP_ENV === 'production' ||
      !env.QB_CLIENT_ID || !env.QB_CLIENT_SECRET || !env.QB_TOKEN_KEY ||
      !/^\d{1,30}$/.test(env.QB_REALM_ID ?? '') || !/^\d{1,3}$/.test(env.QB_MINOR_VERSION ?? '') ||
      env.QB_REDIRECT_URI !== `${env.PUBLIC_ORIGIN}/api/quickbooks/callback` ||
      !/^https:\/\/[^/]+$/.test(env.PUBLIC_ORIGIN)) {
    throw new HttpError(503, 'QUICKBOOKS_NOT_CONFIGURED', 'Sandbox configuration is incomplete.');
  }
}
export async function connection(env: QbEnv): Promise<Connection> {
  const row = await env.DB.prepare('SELECT * FROM qb_connection WHERE id = 1').first<Connection>();
  if (!row) throw new Error('connection_missing');
  return row;
}
export async function audit(env: QbEnv, action: string, generation: number): Promise<void> {
  await env.DB.prepare('INSERT INTO qb_audit(id,action,generation,created_at) VALUES (?,?,?,?)')
    .bind(crypto.randomUUID(), action, generation, Date.now()).run();
}
