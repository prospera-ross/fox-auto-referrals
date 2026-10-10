import test from 'node:test';
import assert from 'node:assert/strict';
import { adminRoute } from '../src/admin/route.ts';
import { database, localEnv } from './helpers.mjs';
import QRCode from 'qrcode';

const owner=async()=> 'operator-sub';
const request=(path,method='GET',body=null,headers={})=>new Request(`http://localhost:8788/api/admin/${path}`,{
  method,headers:{...(body?{'Content-Type':'application/json',Origin:'http://localhost:8788'}:{}),...headers},
  ...(body?{body:JSON.stringify(body)}:{})
});

test('dashboard shell and every data route require an authenticated owner',async()=>{
  const db=database(),env=localEnv(db);
  const denied=async()=>{throw new Error('denied')};
  for(const path of ['dashboard','overview','partners','leads','commissions','partners/00000000-0000-4000-8000-000000000001/qr.svg']){
    await assert.rejects(adminRoute(request(path),env,denied),/denied/);
  }
  const page=await adminRoute(request('dashboard'),env,owner);
  assert.equal(page.status,200);
  assert.match(page.headers.get('content-security-policy'),/default-src 'none'/);
  assert.match(await page.text(),/Referral operations/);
  db.sqlite.close();
});

test('owner can register, list and deactivate a fixed-reward partner with an audit trail',async()=>{
  const db=database(),env=localEnv(db);
  const create=await adminRoute(request('partners','POST',{
    name:'  Main   Street Cafe ',phone:'(202) 555-0188',referral_code:'Main-Street-Cafe',reward_amount_cents:1250
  }),env,owner);
  assert.equal(create.status,201);
  const created=(await create.json()).partner;
  assert.equal(created.name,'Main Street Cafe');
  assert.equal(created.phone,'+12025550188');
  assert.equal(created.referral_code,'main-street-cafe');
  assert.equal(created.reward_amount_cents,1250);
  assert.equal(created.active,true);
  assert.equal(created.version,1);
  assert.equal(created.claim_url,'http://localhost:8788/claim?ref=main-street-cafe');

  const audit=db.sqlite.prepare('SELECT actor_sub,action,target_id,changed_fields FROM admin_audit').get();
  assert.equal(audit.actor_sub,'operator-sub');
  assert.equal(audit.action,'partner_created');
  assert.equal(audit.target_id,created.id);
  assert.deepEqual(JSON.parse(audit.changed_fields),['name','phone','referral_code','reward_amount_cents','active']);
  assert.doesNotMatch(audit.changed_fields,/Main Street|202555/);

  const update=await adminRoute(request(`partners/${created.id}`,'PATCH',{version:1,active:false}),env,owner);
  const changed=(await update.json()).partner;
  assert.equal(changed.active,false);
  assert.equal(changed.version,2);
  assert.deepEqual(JSON.parse(db.sqlite.prepare("SELECT changed_fields FROM admin_audit WHERE action='partner_updated'").get().changed_fields),['active']);

  const list=await adminRoute(request('partners?limit=10&page=1'),env,owner);
  assert.equal((await list.json()).partners.some(row=>row.id===created.id),true);
  await assert.rejects(adminRoute(request(`partners/${created.id}`,'PATCH',{version:1,active:true}),env,owner),error=>error.code==='STALE_PARTNER');
  db.sqlite.close();
});

test('partner mutations reject unsupported fields, foreign origins and conflicts',async()=>{
  const db=database(),env=localEnv(db);
  await assert.rejects(adminRoute(request('partners','POST',{name:'Bad',phone:'(202) 555-0188',referral_code:'bad',reward_amount_cents:1000,percentage:10}),env,owner),error=>error.code==='INVALID_INPUT');
  await assert.rejects(adminRoute(request('partners','POST',{name:'Bad',phone:'(202) 555-0188',referral_code:'bad',reward_amount_cents:1000},{Origin:'https://evil.example'}),env,owner),error=>error.code==='INVALID_ORIGIN');
  const fixture=db.sqlite.prepare('SELECT phone FROM partners LIMIT 1').get();
  await assert.rejects(adminRoute(request('partners','POST',{name:'Duplicate',phone:fixture.phone,referral_code:'new-code',reward_amount_cents:1000}),env,owner),error=>error.code==='PARTNER_CONFLICT');
  db.sqlite.close();
});

test('overview reports integer-cent liabilities without exposing evidence',async()=>{
  const db=database(),env=localEnv(db);
  const response=await adminRoute(request('overview'),env,owner);
  const {overview}=await response.json();
  assert.equal(overview.partners,1);
  assert.equal(overview.active_partners,1);
  assert.equal(overview.open_leads,0);
  assert.equal(overview.pending_reward_cents,0);
  assert.equal('evidence_reference' in overview,false);
  db.sqlite.close();
});

function ledgerFixtures(db){
  const partner=db.sqlite.prepare('SELECT id FROM partners LIMIT 1').get().id;
  db.sqlite.prepare(`INSERT INTO leads
    (id,partner_id,customer_name,customer_phone,customer_email,status,claim_key,payload_hash,payout_type,payout_value_units,created_at)
    VALUES (?,?,?,?,?,'CLAIMED',?,?,'FIXED',2500,?)`).run(
      '10000000-0000-4000-8000-000000000001',partner,'Ledger Customer','+12025550124','ledger@example.test',
      'claim-ledger','a'.repeat(64),'2026-10-01T14:30:00.000Z');
  db.sqlite.prepare(`INSERT INTO conversions
    (id,lead_id,partner_id,quickbooks_invoice_id,quickbooks_realm_id,provider_environment,amount_paid_cents,
      reward_amount_cents,status,currency,policy_version,evidence_reference,quickbooks_customer_id,customer_phone,
      customer_email,payment_date,shop_time_zone,claim_local_date,claim_utc_offset_minutes,created_at)
    VALUES (?,?,?,'1039','9341458457635639','sandbox',22500,2500,'PENDING','USD',
      'fox-fixed-first-30-calendar-days-v2','private-evidence','147','+12025550124','ledger@example.test',
      '2026-10-03','America/New_York','2026-10-01',-240,'2026-10-03T18:00:00.000Z')`).run(
        '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',partner);
  db.sqlite.prepare(`INSERT INTO leads
    (id,partner_id,customer_name,customer_phone,status,claim_key,payload_hash,payout_type,payout_value_units,created_at)
    VALUES (?,?,?,'+12025550125','CLAIMED',?,?,'FIXED',2500,'2026-10-09T12:00:00.000Z')`).run(
      '10000000-0000-4000-8000-000000000002',partner,'Open Customer','claim-open','b'.repeat(64));
  return partner;
}

test('lead ledger filters read-only customer claims and omits tracking internals',async()=>{
  const db=database(),env=localEnv(db),partner=ledgerFixtures(db);
  const response=await adminRoute(request(`leads?partner_id=${partner}&status=COMPLETED&date_from=2026-10-01&date_to=2026-10-01`),env,owner);
  const data=await response.json();
  assert.equal(data.total,1);
  assert.equal(data.leads[0].customer_name,'Ledger Customer');
  assert.equal(data.leads[0].invoice_id,'1039');
  assert.equal(data.leads[0].commission_status,'PENDING');
  assert.equal('claim_key' in data.leads[0],false);
  assert.equal('payload_hash' in data.leads[0],false);
  assert.equal('quickbooks_realm_id' in data.leads[0],false);
  await assert.rejects(adminRoute(request('leads?status=PAID'),env,owner),error=>error.code==='INVALID_FILTER');
  await assert.rejects(adminRoute(request('leads?date_from=2026-02-30'),env,owner),error=>error.code==='INVALID_FILTER');
  db.sqlite.close();
});

test('commission ledger returns integer-cent filtered totals without evidence identifiers',async()=>{
  const db=database(),env=localEnv(db);ledgerFixtures(db);
  const response=await adminRoute(request('commissions?status=PENDING&date_from=2026-10-03&date_to=2026-10-03'),env,owner);
  const data=await response.json();
  assert.equal(data.total,1);
  assert.deepEqual(data.totals,{amount_paid_cents:22500,reward_amount_cents:2500});
  assert.equal(data.commissions[0].invoice_id,'1039');
  assert.equal(data.commissions[0].payment_date,'2026-10-03');
  for(const privateField of ['evidence_reference','quickbooks_realm_id','quickbooks_customer_id','connection_generation']){
    assert.equal(privateField in data.commissions[0],false);
  }
  db.sqlite.close();
});

test('QR route encodes only the immutable public claim URL and supports download',async()=>{
  const db=database(),env=localEnv(db);
  const partner=db.sqlite.prepare('SELECT id,referral_code,name,phone,payout_value_units FROM partners LIMIT 1').get();
  const response=await adminRoute(request(`partners/${partner.id}/qr.svg?download=1`),env,owner);
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/^image\/svg\+xml/);
  assert.equal(response.headers.get('content-disposition'),`attachment; filename="fox-referral-${partner.referral_code}.svg"`);
  const svg=await response.text();
  const expected=await QRCode.toString(`http://localhost:8788/claim?ref=${partner.referral_code}`,{type:'svg',errorCorrectionLevel:'H',margin:4,color:{dark:'#16334aff',light:'#ffffffff'}});
  assert.equal(svg,expected);
  assert.doesNotMatch(svg,new RegExp(partner.name,'i'));
  assert.doesNotMatch(svg,new RegExp(partner.phone.replace('+','\\+')));
  assert.doesNotMatch(svg,new RegExp(String(partner.payout_value_units)));
  db.sqlite.close();
});
