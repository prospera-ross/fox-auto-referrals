import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// Real SQLite constraints/triggers, with a small D1 API bridge. This tests SQL
// semantics, not Cloudflare's remote transaction/permission contracts.
export function database(lastMigration = null) {
  const sqlite = new DatabaseSync(':memory:');
  const migrations = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql') && (!lastMigration || name <= lastMigration)).sort()) {
    sqlite.exec(readFileSync(new URL(name, migrations), 'utf8'));
  }
  sqlite.exec(readFileSync(new URL('../seeds/local.sql', import.meta.url), 'utf8'));
  return { sqlite, prepare(sql) {
    const stmt = sqlite.prepare(sql);
    let params = [];
    return {
      bind(...args) { params = args; return this; },
      async first() { return stmt.get(...params) ?? null; },
      async all() { return { results: stmt.all(...params), success: true }; },
      async run() { const result = stmt.run(...params); return { success: true, meta: { changes: Number(result.changes) } }; }
    };
  } };
}

export const validClaim = { ref: 'restaurant-x', customer_name: 'Sample Customer', customer_phone: '(202) 555-0124', customer_email: 'sample@example.test' };
export function claimRequest(body = validClaim, headers = {}) {
  return new Request('http://localhost:8788/api/claim', { method: 'POST', headers: {
    Origin: 'http://localhost:8788', 'Content-Type': 'application/json', ...headers
  }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
export const localEnv = db => ({ DB: db, APP_ENV: 'local', PUBLIC_ORIGIN: 'http://localhost:8788' });
