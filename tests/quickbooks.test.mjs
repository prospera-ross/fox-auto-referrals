import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processInvoice } from '../src/quickbooks/process-invoice.ts';
import { LocalConversionStore } from '../src/quickbooks/local-store.ts';
import { cents, fixedRewardCents } from '../src/quickbooks/money.ts';
import { firstEligibleClaim, POLICY_VERSION, CLAIM_VALIDITY_DAYS } from '../src/quickbooks/policy.ts';
import { verifyWebhook } from '../src/quickbooks/webhook.ts';
import worker from '../src/index.ts';
import { database, claimRequest, localEnv, validClaim } from './helpers.mjs';

const binding = { realmId: '12345', environment: 'sandbox', generation: 1 };
function fixtures() {
  const invoice = { Id: '100', CustomerRef: { value: '20' }, TotalAmt: '80.00', Balance: '0.00', CurrencyRef: { value: 'USD' },
    MetaData: { CreateTime: '2099-01-01T00:00:00Z', LastUpdatedTime: '2099-01-02T00:00:00Z' }, LinkedTxn: [{ TxnType: 'Payment', TxnId: '200' }] };
  const customer = { Id: '20', PrimaryPhone: { FreeFormNumber: '+1 (202) 555-0124' }, PrimaryEmailAddr: { Address: 'sample@example.test' } };
  const payment = { Id: '200', CustomerRef: { value: '20' }, CurrencyRef: { value: 'USD' }, TotalAmt: '80.00', Line: [{ Amount: '80.00', LinkedTxn: [{ TxnType: 'Invoice', TxnId: '100' }] }] };
  const evidence = { reference: 'synthetic:test-evidence', paymentDate: new Date().toISOString().slice(0,10), timeZone: 'UTC' };
  const qbo = { assertAuthorized: async () => {}, readInvoice: async () => invoice, readCustomer: async () => customer,
    readPayment: async () => payment, retainEvidence: async () => evidence };
  return { invoice, customer, payment, qbo, evidence };
}

test('decimal money and fixed rewards use integer cents', () => {
  assert.equal(cents('0.29'), 29);
  assert.equal(cents(0.29), 29);
  assert.equal(fixedRewardCents(1000), 1000);
  for (const bad of [-1, '1.001', 'NaN', Infinity, '1e2', 1000001]) assert.throws(() => cents(bad));
  assert.throws(() => fixedRewardCents(10.5));
  assert.throws(() => fixedRewardCents(-1));
});

test('verified invoice credits exactly once and completes lead atomically', async () => {
  const db = database();
  await worker.fetch(claimRequest(), localEnv(db));
  const store = new LocalConversionStore(db, 'synthetic-local');
  const deps = { ...fixtures(), store };
  const results = await Promise.all(Array.from({ length: 6 }, () => processInvoice(binding, '100', deps)));
  assert.equal(results.filter(result => result === 'created').length, 1);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM conversions').get().n, 1);
  const conversion = db.sqlite.prepare('SELECT * FROM conversions').get();
  assert.equal(conversion.amount_paid_cents, 8000);
  assert.equal(conversion.reward_amount_cents, 2500);
  assert.equal(conversion.amount_paid, 80);
  assert.equal(conversion.status, 'PENDING');
  assert.equal(db.sqlite.prepare('SELECT status FROM leads').get().status, 'COMPLETED');
  db.sqlite.close();
});

test('unpaid, credit-only, partial payment, currency, identity and pre-claim payment do not convert', async () => {
  for (const [mutate, expected] of [
    [f => { f.invoice.Balance = 10; }, 'unpaid'],
    [f => { f.invoice.LinkedTxn = []; }, 'held'],
    [f => { f.invoice.LinkedTxn[0].TxnType = 'CreditMemo'; }, 'held'],
    [f => { f.payment.Line[0].Amount = 40; }, 'held'],
    [f => { f.payment.CurrencyRef.value = 'CAD'; }, 'held'],
    [f => { f.payment.CustomerRef.value = '30'; }, 'held'],
    [f => { f.customer.PrimaryPhone.FreeFormNumber = '2025550199'; }, 'held'],
    [f => { f.evidence.paymentDate = '2000-01-01'; }, 'ineligible'],
    [f => { f.qbo.retainEvidence = async () => null; }, 'held']
  ]) {
    const db = database(); await worker.fetch(claimRequest(), localEnv(db));
    const f = fixtures(); mutate(f);
    assert.equal(await processInvoice(binding, '100', { ...f, store: new LocalConversionStore(db, 'synthetic-local') }), expected);
    assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM conversions').get().n, 0);
    assert.equal(db.sqlite.prepare('SELECT status FROM leads').get().status, 'CLAIMED');
    db.sqlite.close();
  }
});

test('revocation after reads prevents credit', async () => {
  const db = database(); await worker.fetch(claimRequest(), localEnv(db));
  const f = fixtures(); let checks = 0;
  f.qbo.assertAuthorized = async () => { if (++checks >= 4) throw new Error('revoked'); };
  await assert.rejects(processInvoice(binding, '100', { ...f, store: new LocalConversionStore(db, 'synthetic-local') }), /revoked/);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM conversions').get().n, 0);
  db.sqlite.close();
});

test('same-day and day-30 payments qualify; day 31 and pre-claim dates do not', async () => {
  for (const [paymentDate,expected] of [['2020-01-01','created'],['2020-01-30','created'],['2020-01-31','ineligible'],['2019-12-31','ineligible']]) {
    const db = database(); await worker.fetch(claimRequest(), localEnv(db));
    db.sqlite.exec("UPDATE leads SET created_at='2020-01-02T04:59:59.000Z'"); // Jan 1, 23:59:59 in New York
    const f = fixtures(); f.evidence.paymentDate=paymentDate; f.evidence.timeZone='America/New_York';
    assert.equal(await processInvoice(binding, '100', { ...f, store: new LocalConversionStore(db, 'synthetic-local') }), expected);
    const c=db.sqlite.prepare('SELECT * FROM conversions').get();
    if(expected==='created') {
      assert.equal(c.paid_at,null); assert.equal(c.payment_date,paymentDate);
      assert.equal(c.claim_local_date,'2020-01-01'); assert.equal(c.claim_utc_offset_minutes,-300);
      assert.equal(c.shop_time_zone,'America/New_York');
    } else assert.equal(c,undefined);
    db.sqlite.close();
  }
});

test('database rejects wrong partner and failed conversion leaves claim untouched', async () => {
  const db = database(); await worker.fetch(claimRequest(), localEnv(db));
  const lead = db.sqlite.prepare('SELECT * FROM leads').get();
  const store = new LocalConversionStore(db, 'synthetic-local');
  const c = { id: crypto.randomUUID(), leadId: lead.id, partnerId: lead.partner_id, invoiceId: '100', binding,
    paidCents: -1, rewardCents: 2500, policyVersion: POLICY_VERSION, evidenceReference: 'synthetic:test',
    customerId: '20', customerPhone: lead.customer_phone, customerEmail: lead.customer_email,
    paymentDate: new Date().toISOString().slice(0,10), timeZone: 'UTC' };
  await assert.rejects(store.creditOnce(c));
  assert.equal(db.sqlite.prepare('SELECT status FROM leads').get().status, 'CLAIMED');
  assert.equal(await store.creditOnce({ ...c, paidCents: 100, partnerId: 'wrong' }), 'held');
  db.sqlite.close();
});

async function addClaim(db, date, patch = {}) {
  const key = crypto.randomUUID();
  const response = await worker.fetch(claimRequest({ ...validClaim, ...patch }, { 'Idempotency-Key': key }), localEnv(db));
  assert.equal(response.status, 200);
  db.sqlite.prepare('UPDATE leads SET created_at = ? WHERE claim_key = ?').run(date, key);
  return db.sqlite.prepare('SELECT *, rowid AS claim_order FROM leads WHERE claim_key = ?').get(key);
}
function secondPartner(db) {
  db.sqlite.exec(`INSERT INTO partners(id,name,phone,referral_code,payout_type,payout_value_units)
    VALUES ('partner-two','Second Fixture','+12025550129','second-partner','FIXED',5000)`);
}

test('first claim wins across partners and equal timestamps; later claims cannot refresh expiry', async () => {
  const db = database(); secondPartner(db);
  const first = await addClaim(db, '2026-09-01T00:00:00.000Z');
  await addClaim(db, first.created_at, { ref: 'second-partner' });
  await addClaim(db, '2026-09-29T00:00:00.000Z', { ref: 'second-partner' });
  const leads = await new LocalConversionStore(db, 'synthetic-local').findCandidates(first.customer_phone, first.customer_email);
  assert.equal(firstEligibleClaim(leads.reverse(), '2026-09-30', 'UTC').id, first.id);
  assert.equal(firstEligibleClaim(leads, '2026-10-01', 'UTC'), null);
  assert.equal(firstEligibleClaim(leads, '2026-08-31', 'UTC'), null);
  assert.equal(CLAIM_VALIDITY_DAYS, 30);
  const f = fixtures(); f.evidence.paymentDate = '2026-09-20';
  // No oil-change line or percentage/tax calculation is required.
  f.invoice.Line = [{ DetailType: 'SalesItemLineDetail', Description: 'Brake service' }];
  assert.equal(await processInvoice(binding, '100', { ...f, store: new LocalConversionStore(db, 'synthetic-local') }), 'created');
  const conversion = db.sqlite.prepare('SELECT * FROM conversions').get();
  assert.equal(conversion.lead_id, first.id);
  assert.equal(conversion.partner_id, first.partner_id);
  assert.equal(conversion.reward_amount_cents, 2500);
  assert.equal(conversion.payment_date, f.evidence.paymentDate);
  // A later webhook/scan for the credited invoice is a duplicate, not ineligible.
  assert.equal(await processInvoice(binding, '100', { ...f, store: new LocalConversionStore(db, 'synthetic-local') }), 'duplicate');
  db.sqlite.close();
});

test('late webhook uses payment time, including invoices created before the claim', async () => {
  const db = database(); await addClaim(db, '2020-01-01T00:00:00.000Z');
  const f = fixtures();
  f.invoice.MetaData.CreateTime = '2019-12-01T00:00:00.000Z';
  f.evidence.paymentDate = '2020-01-15';
  assert.equal(await processInvoice(binding, '100', { ...f, store: new LocalConversionStore(db, 'synthetic-local') }), 'created');
  db.sqlite.close();
});

test('an expired first claim never promotes the next partner', async () => {
  const db = database(); secondPartner(db);
  const first = await addClaim(db, '2026-08-01T00:00:00.000Z');
  await addClaim(db, '2026-10-01T00:00:00.000Z', { ref: 'second-partner' });
  const f = fixtures(); f.evidence.paymentDate = '2026-10-02';
  const store = new LocalConversionStore(db, 'synthetic-local');
  assert.equal(await processInvoice(binding, '100', { ...f, store }), 'ineligible');
  db.sqlite.prepare("UPDATE leads SET status = 'EXPIRED' WHERE id = ?").run(first.id);
  assert.equal(await processInvoice(binding, '100', { ...f, store }), 'ineligible');
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM conversions').get().n, 0);
  db.sqlite.close();
});

test('concurrent different paid invoices and later claims earn only one customer reward', async () => {
  const db = database(); secondPartner(db);
  await addClaim(db, '2026-10-01T00:00:00.000Z');
  await addClaim(db, '2026-10-02T00:00:00.000Z', { ref: 'second-partner' });
  const store = new LocalConversionStore(db, 'synthetic-local');
  const run = id => {
    const f = fixtures(); f.invoice.Id = id; f.payment.Line[0].LinkedTxn[0].TxnId = id;
    f.evidence.paymentDate = '2026-10-03';
    return processInvoice(binding, id, { ...f, store });
  };
  const results = await Promise.all([run('100'), run('101')]);
  assert.equal(results.filter(result => result === 'created').length, 1);
  assert.equal(await run('102'), 'ineligible');
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM conversions').get().n, 1);
  db.sqlite.close();
});

test('same QBO customer cannot earn again after changing contact; email fallback is supported', async () => {
  const db = database(); await addClaim(db, '2026-10-01T00:00:00.000Z');
  const store = new LocalConversionStore(db, 'synthetic-local');
  const f = fixtures(); f.evidence.paymentDate = '2026-10-02';
  delete f.customer.PrimaryPhone;
  assert.equal(await processInvoice(binding, '100', { ...f, store }), 'created');
  await addClaim(db, '2026-10-01T00:00:00.000Z', { customer_phone: '2025550166', customer_email: 'changed@example.test' });
  f.customer.PrimaryPhone = { FreeFormNumber: '2025550166' };
  f.customer.PrimaryEmailAddr.Address = 'changed@example.test';
  f.invoice.Id = '101'; f.payment.Line[0].LinkedTxn[0].TxnId = '101';
  assert.equal(await processInvoice(binding, '101', { ...f, store }), 'held');
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM conversions').get().n, 1);
  db.sqlite.close();
});

test('database enforces fixed payouts, first claim, exact snapshot reward and expiry', async () => {
  const db = database(); secondPartner(db);
  assert.throws(() => db.sqlite.exec("UPDATE partners SET payout_type = 'PERCENTAGE'"), /fixed_rewards_only/);
  const first = await addClaim(db, '2026-10-01T00:00:00.000Z');
  const later = await addClaim(db, '2026-10-02T00:00:00.000Z', { ref: 'second-partner' });
  const store = new LocalConversionStore(db, 'synthetic-local');
  const c = { id: crypto.randomUUID(), leadId: first.id, partnerId: first.partner_id, invoiceId: '100', binding,
    paidCents: 8000, rewardCents: 2500, policyVersion: POLICY_VERSION, evidenceReference: 'synthetic:test',
    customerId: '20', customerPhone: first.customer_phone, customerEmail: first.customer_email, paymentDate: '2026-10-03', timeZone: 'UTC' };
  await assert.rejects(store.creditOnce({ ...c, leadId: later.id, partnerId: later.partner_id, rewardCents: 5000 }), /ineligible_conversion/);
  await assert.rejects(store.creditOnce({ ...c, paymentDate: '2026-10-31' }), /ineligible_conversion/);
  await assert.rejects(store.creditOnce({ ...c, rewardCents: 1000 }), /ineligible_conversion/);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM conversions').get().n, 0);
  assert.equal(await store.creditOnce(c), 'created');
  assert.equal(await store.creditOnce(c), 'duplicate');
  db.sqlite.close();
});

async function signed(body, signatureBody = body) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('synthetic-verifier'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureBody)))));
  return new Request('https://example.test/api/quickbooks/webhook', { method: 'POST', body, headers: { 'intuit-signature': signature } });
}
const event = { specversion: '1.0', id: 'event-1', source: 'intuit.synthetic', type: 'qbo.invoice.updated.v1', datacontenttype: 'application/json', time: '2026-10-09T12:00:00Z', intuitentityid: '100', intuitaccountid: '12345' };

test('webhook signature covers exact bytes; mixed events keep independent company IDs', async () => {
  const body = JSON.stringify([event, { ...event, id: 'event-2', intuitaccountid: '99999' }, { malformed: true }]);
  const result = await verifyWebhook(await signed(body), 'synthetic-verifier');
  assert.equal(result[0].event.intuitaccountid, '12345');
  assert.equal(result[1].event.intuitaccountid, '99999');
  assert.equal(result[2].kind, 'rejected');
  await assert.rejects(verifyWebhook(await signed(body + ' ', body), 'synthetic-verifier'), /invalid_signature/);
  await assert.rejects(verifyWebhook(new Request('https://example.test', { method: 'POST', body }), 'synthetic-verifier'), /invalid_signature/);
  await assert.rejects(verifyWebhook(await signed(JSON.stringify({ eventNotifications: [] })), 'synthetic-verifier'), /invalid_envelope/);
});
