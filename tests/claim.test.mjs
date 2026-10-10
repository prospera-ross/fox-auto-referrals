import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import { SHOP_GENIE_URL } from '../src/claim.ts';
import { database, validClaim, claimRequest, localEnv } from './helpers.mjs';

test('claim normalizes contacts, snapshots reward, returns only fixed booking destination', async () => {
  const db = database();
  const response = await worker.fetch(claimRequest({ ...validClaim, customer_email: ' SAMPLE@EXAMPLE.TEST ' }), localEnv(db));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, redirect_url: SHOP_GENIE_URL });
  const lead = db.sqlite.prepare('SELECT * FROM leads').get();
  assert.equal(lead.customer_phone, '+12025550124');
  assert.equal(lead.customer_email, 'sample@example.test');
  assert.equal(lead.status, 'CLAIMED');
  assert.equal(lead.payout_value_units, 2500);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  db.sqlite.close();
});

test('simultaneous retries create one lead; changed payload under same key is rejected', async () => {
  const db = database();
  const headers = { 'Idempotency-Key': crypto.randomUUID() };
  const results = await Promise.all(Array.from({ length: 8 }, () => worker.fetch(claimRequest(validClaim, headers), localEnv(db))));
  assert(results.every(result => result.status === 200));
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM leads').get().n, 1);
  assert.equal((await worker.fetch(claimRequest({ ...validClaim, customer_name: 'Changed' }, headers), localEnv(db))).status, 409);
  db.sqlite.close();
});

test('optional email, malformed and hostile inputs, unknown/inactive referral, oversized body', async () => {
  const db = database();
  assert.equal((await worker.fetch(claimRequest({ ...validClaim, customer_email: '' }), localEnv(db))).status, 200);
  for (const [body, status] of [
    [{ ...validClaim, customer_phone: '2025550124 ext 8' }, 400],
    [{ ...validClaim, customer_phone: '123' }, 400],
    [{ ...validClaim, customer_email: 'invalid' }, 400],
    [{ ...validClaim, customer_name: ' ' }, 400],
    [{ ...validClaim, status: 'COMPLETED' }, 400],
    [{ ...validClaim, partner_id: 'fake' }, 400],
    [{ ...validClaim, ref: "x' OR 1=1 --" }, 400],
    [{ ...validClaim, ref: 'missing' }, 400],
    ['{broken', 400], ['x'.repeat(5000), 413]
  ]) assert.equal((await worker.fetch(claimRequest(body), localEnv(db))).status, status);
  db.sqlite.exec('UPDATE partners SET active = 0');
  assert.equal((await worker.fetch(claimRequest(), localEnv(db))).status, 400);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM leads').get().n, 1);
  db.sqlite.close();
});

test('origin/type/method checks and financial route fail closed', async () => {
  const db = database();
  assert.equal((await worker.fetch(claimRequest(validClaim, { Origin: 'https://evil.example' }), localEnv(db))).status, 403);
  assert.equal((await worker.fetch(claimRequest(validClaim, { 'Content-Type': 'text/plain' }), localEnv(db))).status, 415);
  assert.equal((await worker.fetch(new Request('http://localhost/api/claim'), localEnv(db))).status, 405);
  assert.equal((await worker.fetch(new Request('https://example.test/api/quickbooks/webhook', { method: 'POST' }), localEnv(db))).status, 503);
  assert.equal((await worker.fetch(claimRequest(), { ...localEnv(db), APP_ENV: 'production' })).status, 503);
  db.sqlite.close();
});

test('database failure is redacted and never returns successful redirect', async () => {
  const response = await worker.fetch(claimRequest(), localEnv({ prepare() { throw new Error('secret-marker customer PII'); } }));
  assert.equal(response.status, 503);
  assert(!(await response.text()).includes('secret-marker'));
});
