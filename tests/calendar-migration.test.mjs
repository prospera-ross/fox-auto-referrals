import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { database, claimRequest, localEnv } from './helpers.mjs';
import worker from '../src/index.ts';

test('calendar migration preserves legacy rewards and only requeues current evidence holds',async()=>{
  const db=database('0003_quickbooks_sandbox.sql');
  await worker.fetch(claimRequest(),localEnv(db));
  db.sqlite.exec("UPDATE leads SET created_at='2020-01-01T00:00:00.000Z'");
  const lead=db.sqlite.prepare('SELECT * FROM leads').get();
  db.sqlite.prepare(`INSERT INTO conversions
    (id,lead_id,partner_id,quickbooks_invoice_id,quickbooks_realm_id,provider_environment,
     amount_paid_cents,reward_amount_cents,policy_version,evidence_reference,
     quickbooks_customer_id,customer_phone,customer_email,paid_at)
    VALUES ('legacy',?,?,'100','12345','sandbox',8000,2500,'fox-fixed-first-30d-v1','synthetic-legacy',
      '20',?,?,'2020-01-02T00:00:00.000Z')`).run(lead.id,lead.partner_id,lead.customer_phone,lead.customer_email);
  const before=db.sqlite.prepare('SELECT * FROM conversions').get();
  db.sqlite.exec("UPDATE qb_connection SET state='active',realm_id='12345',generation=2,paused=0");
  for(const [key,state,reason,generation,realm] of [
    ['current','quarantined','evidence_review_required',2,'12345'],
    ['old','quarantined','evidence_review_required',1,'12345'],
    ['foreign','quarantined','evidence_review_required',2,'999'],
    ['conflict','conflict','evidence_review_required',2,'12345'],
    ['other','quarantined','processing_failed',2,'12345']
  ]) db.sqlite.prepare(`INSERT INTO qb_events(event_key,digest,realm_id,generation,state,reason,available_at,created_at)
      VALUES (?, 'synthetic',?,?,?,?,0,0)`).run(key,realm,generation,state,reason);
  db.sqlite.exec(readFileSync(new URL('../migrations/0004_calendar_day_policy.sql',import.meta.url),'utf8'));
  const after=db.sqlite.prepare('SELECT * FROM conversions').get();
  for(const key of Object.keys(before))assert.equal(after[key],before[key]);
  assert.equal(after.payment_date,null);
  assert.equal(db.sqlite.prepare('SELECT status FROM leads').get().status,'COMPLETED');
  assert.deepEqual(db.sqlite.prepare("SELECT event_key FROM qb_events WHERE state='pending'").all().map(x=>x.event_key),['current']);
  db.sqlite.close();
});
