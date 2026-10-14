import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { database, claimRequest, localEnv } from './helpers.mjs';
import { seal, unseal, randomSecret } from '../src/quickbooks/crypto.ts';
import { requireAdmin, session } from '../src/quickbooks/admin.ts';
import { oauthRoute } from '../src/quickbooks/oauth.ts';
import { getAccessToken, revoke } from '../src/quickbooks/tokens.ts';
import { webhook } from '../src/quickbooks/inbox.ts';
import { runScheduled } from '../src/quickbooks/jobs.ts';
import { SandboxReader } from '../src/quickbooks/reader.ts';
import { LocalConversionStore } from '../src/quickbooks/local-store.ts';
import { POLICY_VERSION, shopCalendar, firstEligibleClaim } from '../src/quickbooks/policy.ts';
import worker from '../src/index.ts';

function envFor(db) {
  return { DB:db,APP_ENV:'staging',PUBLIC_ORIGIN:'https://fox-referrals.pages.dev',QB_ENABLED:'true',
    QB_CLIENT_ID:'synthetic-client',QB_CLIENT_SECRET:'synthetic-client-secret',
    QB_TOKEN_KEY:btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
    QB_REALM_ID:'12345',QB_MINOR_VERSION:'75',QB_TIME_ZONE:'America/New_York',
    QB_REDIRECT_URI:'https://fox-referrals.pages.dev/api/quickbooks/callback',QB_WEBHOOK_VERIFIER:'synthetic-verifier',
    ACCESS_TEAM_DOMAIN:'https://fixture.cloudflareaccess.com',ACCESS_AUD:'fixture-audience',ACCESS_ADMIN_SUB:'operator' };
}
const pair = (expires=Date.now()+3600000) => ({ access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_at:expires,refresh_expires_at:Date.now()+86400000 });
const responsePair = () => ({access_token:'synthetic-new-access',refresh_token:'synthetic-new-refresh',token_type:'bearer',expires_in:3600,x_refresh_token_expires_in:86400});
async function active(env, expires) {
  const envelope=await seal(env,1,1,pair(expires));
  await env.DB.prepare(`UPDATE qb_connection SET realm_id=?,generation=1,credential_generation=1,token_version=1,state='active',paused=0,
    token_envelope=?,access_expires_at=?,refresh_expires_at=? WHERE id=1`).bind(env.QB_REALM_ID,envelope,expires??Date.now()+3600000,Date.now()+86400000).run();
}
const admin=async()=> 'operator';
const request=(env,path,method='GET',cookie='',query='')=>new Request(`${env.PUBLIC_ORIGIN}/api/quickbooks/${path}${query}`,{
  method,headers:{Origin:env.PUBLIC_ORIGIN,Cookie:cookie}
});
async function start(env) {
  const page=await oauthRoute(request(env,'connect'),env,fetch,admin);
  const cookie=page.headers.get('Set-Cookie').split(';')[0];
  assert.equal(session(request(env,'connect','POST',cookie)).length,43);
  const response=await oauthRoute(request(env,'connect','POST',cookie),env,fetch,admin);
  return {cookie,state:new URL(response.headers.get('Location')).searchParams.get('state')};
}
const event = (patch={}) => ({specversion:'1.0',id:crypto.randomUUID(),source:'intuit.synthetic',type:'qbo.invoice.updated.v1',datacontenttype:'application/json',time:'2026-10-09T12:00:00Z',intuitentityid:'100',intuitaccountid:'12345',...patch});
async function signed(env,events) {
  const body=JSON.stringify(events);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.QB_WEBHOOK_VERIFIER),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)))));
  return new Request(`${env.PUBLIC_ORIGIN}/api/quickbooks/webhook`,{method:'POST',body,headers:{'intuit-signature':signature}});
}

test('credential envelope rejects ciphertext, realm, app, generation and version swaps', async()=>{
  const db=database(), env=envFor(db);
  const encrypted=await seal(env,1,1,pair());
  assert(!encrypted.includes('synthetic-access'));
  assert.equal((await unseal(env,1,1,encrypted)).refresh_token,'synthetic-refresh');
  for(const altered of [{...env,QB_REALM_ID:'999'},{...env,QB_CLIENT_ID:'other'}])await assert.rejects(unseal(altered,1,1,encrypted));
  await assert.rejects(unseal(env,2,1,encrypted));
  await assert.rejects(unseal(env,1,2,encrypted));
  const corrupt=JSON.parse(encrypted);corrupt.data='A'+corrupt.data.slice(1);
  // Modify an actual byte even if the first base64 character was already A.
  const raw=Uint8Array.from(atob(corrupt.data),c=>c.charCodeAt(0));raw[5]^=1;corrupt.data=btoa(String.fromCharCode(...raw));
  await assert.rejects(unseal(env,1,1,JSON.stringify(corrupt)));
  db.sqlite.close();
});

test('operator JWT verifies signature, issuer, audience, subject and expiry', async()=>{
  const db=database(),env=envFor(db);
  const {publicKey,privateKey}=await generateKeyPair('RS256');
  const jwk=await exportJWK(publicKey);jwk.kid='fixture';jwk.alg='RS256';
  const resolver=createLocalJWKSet({keys:[jwk]});
  const make=async(overrides={})=>new SignJWT({sub:'operator',iss:env.ACCESS_TEAM_DOMAIN,aud:env.ACCESS_AUD,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600,...overrides}).setProtectedHeader({alg:'RS256',kid:'fixture'}).sign(privateKey);
  const req=token=>new Request(env.PUBLIC_ORIGIN,{headers:{'Cf-Access-Jwt-Assertion':token}});
  assert.equal(await requireAdmin(req(await make()),env,resolver),'operator');
  for(const bad of [{sub:'intruder'},{aud:'wrong'},{iss:'https://evil.example'},{exp:1},{iat:Math.floor(Date.now()/1000)-3600}])await assert.rejects(requireAdmin(req(await make(bad)),env,resolver));
  await assert.rejects(requireAdmin(req('not-a-jwt'),env,resolver));
  db.sqlite.close();
});

test('OAuth requires state/session/realm, encrypts tokens, confirms company, rejects replay', async()=>{
  const db=database(),env=envFor(db),auth=await start(env);
  let exchanges=0;
  const send=async(url,init)=>{
    if(String(url).includes('/tokens/bearer')){exchanges++;assert.equal(init.redirect,'manual');assert(init.headers.Authorization.startsWith('Basic '));return Response.json(responsePair());}
    assert(String(url).startsWith('https://sandbox-quickbooks.api.intuit.com/v3/company/12345/companyinfo/12345'));
    return Response.json({CompanyInfo:{Id:'1',CompanyName:'Synthetic Fox'}});
  };
  const callback=()=>request(env,'callback','GET',auth.cookie,`?state=${auth.state}&code=synthetic-code&realmId=12345`);
  const result=await oauthRoute(callback(),env,send,admin);
  assert.equal(result.status,303);assert(!result.headers.get('Location').includes('code='));
  const pending=db.sqlite.prepare('SELECT * FROM qb_connection').get();
  assert.equal(pending.state,'pending');assert.equal(pending.paused,1);assert(!pending.token_envelope.includes('synthetic-new-access'));
  await assert.rejects(getAccessToken(env,1,send));
  await oauthRoute(callback(),env,send,admin);assert.equal(exchanges,1);
  const status=await oauthRoute(request(env,'status','GET',auth.cookie),env,send,admin);
  const statusText=await status.text();assert(statusText.includes('Synthetic Fox'));assert(!statusText.includes('synthetic-new-refresh'));
  await oauthRoute(request(env,'confirm','POST',auth.cookie),env,send,admin);
  assert.equal(db.sqlite.prepare('SELECT state FROM qb_connection').get().state,'active');
  await assert.rejects(oauthRoute(new Request(`${env.PUBLIC_ORIGIN}/api/quickbooks/pause`,{method:'POST',headers:{Origin:'https://evil.example'}}),env,send,admin));
  db.sqlite.close();
});

test('operator forms reject missing, null and foreign origins without changing authority',async()=>{
  const db=database(),env=envFor(db);
  try {
    for(const path of ['connect','confirm','pause','resume','disconnect']) {
      for(const origin of [undefined,'null','https://evil.example']) {
        const req=new Request(`${env.PUBLIC_ORIGIN}/api/quickbooks/${path}`,{
          method:'POST',headers:origin===undefined?{}:{Origin:origin}
        });
        await assert.rejects(oauthRoute(req,env,async()=>{throw new Error('No provider dispatch');},admin),
          error=>error.status===403&&error.code==='INVALID_ORIGIN');
      }
    }
    assert.equal(db.sqlite.prepare('SELECT state FROM qb_connection').get().state,'empty');
    assert.equal(db.sqlite.prepare('SELECT count(*) n FROM qb_oauth_states').get().n,0);
    assert.equal(db.sqlite.prepare('SELECT count(*) n FROM qb_audit').get().n,0);
  } finally {db.sqlite.close();}
});

test('OAuth failure diagnostics identify stages without persisting provider secrets or allowing retries',async()=>{
  const marker='synthetic-secret-must-not-appear';
  const cases=[
    ['exchange_transport_other',async()=>{throw new Error(marker);}],
    ['exchange_http_400',async()=>new Response(marker,{status:400})],
    ['exchange_http_401',async()=>new Response(marker,{status:401})],
    ['exchange_http_403',async()=>new Response(marker,{status:403})],
    ['exchange_http_429',async()=>new Response(marker,{status:429})],
    ['exchange_http_5xx',async()=>new Response(marker,{status:503})],
    ['exchange_http_other',async()=>new Response(marker,{status:418})],
    ['exchange_http_3xx',async()=>new Response(null,{status:302,headers:{Location:'https://must-not-follow.invalid'}})],
    ['exchange_body',async()=>new Response(marker)],
    ['exchange_shape',async()=>Response.json(null)],
    ['encrypt',async()=>Response.json(responsePair())],
    ['company_read',async(url)=>{
      if(String(url).includes('/tokens/bearer'))return Response.json(responsePair());
      throw new Error(marker);
    }]
  ];
  for(const [reason,send] of cases) {
    const db=database(),env=envFor(db),auth=await start(env);let calls=0;
    try {
      if(reason==='encrypt')env.QB_TOKEN_KEY='invalid-base64';
      const callback=()=>request(env,'callback','GET',auth.cookie,`?state=${auth.state}&code=synthetic-code&realmId=12345`);
      const invoke=async(...args)=>{calls++;return send(...args);};
      const result=await oauthRoute(callback(),env,invoke,admin);
      assert.equal(result.status,303);
      const c=db.sqlite.prepare('SELECT * FROM qb_connection').get();
      assert.equal(c.state,reason==='company_read'?'pending':'refresh_unknown');assert.equal(c.paused,1);
      const records=db.sqlite.prepare('SELECT action FROM qb_audit').all();
      assert.deepEqual(records.map(row=>row.action),[`oauth_failed_${reason}`]);
      assert(!JSON.stringify(records).includes(marker));
      const before=calls;await oauthRoute(callback(),env,invoke,admin);assert.equal(calls,before);
      await assert.rejects(oauthRoute(request(env,'connect','POST',auth.cookie),env,invoke,admin));
      await assert.rejects(getAccessToken(env,c.generation,invoke));
      const status=await oauthRoute(request(env,'status','GET',auth.cookie),env,invoke,admin);
      const text=await status.text();assert(!text.includes(marker));
      if(reason!=='company_read')assert(text.includes('Operator recovery is required'));
    } finally {db.sqlite.close();}
  }
});

test('admin connectivity probe uses an invalid code and records fixed categories only',async()=>{
  const db=database(),env=envFor(db);let calls=0;
  try {
    db.sqlite.exec("UPDATE qb_connection SET state='refresh_unknown',realm_id='12345',generation=1,paused=1");
    const send=async(_url,init)=>{
      calls++;assert(String(init.body).includes('fox-referrals-connectivity-probe-never-issued'));
      if(calls===1){assert.equal(init.redirect,'error');throw new TypeError('synthetic secret detail');}
      assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://ignored.invalid'}});
    };
    const response=await oauthRoute(request(env,'probe','POST'),env,send,admin);
    assert.equal(response.status,303);assert.equal(calls,2);
    assert.equal(db.sqlite.prepare('SELECT action FROM qb_audit').get().action,'oauth_probe_transport_type_manual_3xx');
    const status=await oauthRoute(request(env,'status'),env,send,admin);
    const html=await status.text();assert(html.includes('transport_type_manual_3xx'));assert(!html.includes('synthetic secret detail'));
  } finally {db.sqlite.close();}
});

test('OAuth wrong browser/expired state/wrong company cannot exchange a code', async()=>{
  for(const kind of ['browser','expired','realm']) {
    const db=database(),env=envFor(db),auth=await start(env);let calls=0;
    if(kind==='expired')db.sqlite.exec('UPDATE qb_oauth_states SET expires_at=0');
    await oauthRoute(request(env,'callback','GET',kind==='browser'?`__Host-qb-session=${randomSecret()}`:auth.cookie,
      `?state=${auth.state}&code=synthetic-code&realmId=${kind==='realm'?'999':'12345'}`),env,async()=>{calls++;throw new Error('must-not-call');},admin);
    assert.equal(calls,0);assert.equal(db.sqlite.prepare('SELECT state FROM qb_connection').get().state,'empty');
    db.sqlite.close();
  }
});

test('parallel renewal sends exactly one refresh and persists latest encrypted pair',async()=>{
  const db=database(),env=envFor(db);await active(env,Date.now()-1);let calls=0;
  const send=async()=>{calls++;return Response.json(responsePair());};
  const results=await Promise.allSettled(Array.from({length:6},()=>getAccessToken(env,1,send)));
  assert.equal(calls,1);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const c=db.sqlite.prepare('SELECT * FROM qb_connection').get();
  assert.equal(c.token_version,2);assert.equal(c.state,'active');
  assert.equal((await unseal(env,1,2,c.token_envelope)).refresh_token,'synthetic-new-refresh');
  db.sqlite.close();
});

test('uncertain renewal is held and never retried; late results cannot reactivate a disconnect',async()=>{
  const db=database(),env=envFor(db);await active(env,Date.now()-1);let calls=0;
  const fail=async()=>{calls++;throw new Error('synthetic network failure');};
  await assert.rejects(getAccessToken(env,1,fail));await assert.rejects(getAccessToken(env,1,fail));
  assert.equal(calls,1);assert.equal(db.sqlite.prepare('SELECT state FROM qb_connection').get().state,'refresh_unknown');
  assert.deepEqual(db.sqlite.prepare('SELECT action FROM qb_audit').all().map(r=>r.action),['refresh_failed_transport_other']);
  db.sqlite.close();
  const db2=database(),env2=envFor(db2);await active(env2,Date.now()-1);
  await assert.rejects(getAccessToken(env2,1,async()=>{
    db2.sqlite.exec("UPDATE qb_connection SET state='revocation_pending',paused=1,generation=generation+1");
    return Response.json(responsePair());
  }));
  assert.equal(db2.sqlite.prepare('SELECT state FROM qb_connection').get().state,'revocation_pending');
  assert.equal(db2.sqlite.prepare('SELECT token_version FROM qb_connection').get().token_version,1);
  db2.sqlite.close();
});

test('disconnect disables authority first and clears ciphertext only after confirmed revocation',async()=>{
  const db=database(),env=envFor(db);await active(env);
  await revoke(env,async()=>{
    const c=db.sqlite.prepare('SELECT * FROM qb_connection').get();assert.equal(c.state,'revocation_pending');assert.equal(c.generation,2);
    return new Response(null,{status:200});
  });
  const c=db.sqlite.prepare('SELECT * FROM qb_connection').get();assert.equal(c.state,'revoked');assert.equal(c.token_envelope,null);
  db.sqlite.close();
});

test('Intuit void and delete events are durable review holds, never conversion reads',async()=>{
  const db=database(),env=envFor(db);await active(env);
  try {
    const events=['invoice','payment'].flatMap(entity=>['void','deleted'].map(operation=>
      event({type:`qbo.${entity}.${operation}.v1`})));
    assert.equal((await webhook(await signed(env,events),env)).status,200);
    await webhook(await signed(env,events),env);
    const pending=db.sqlite.prepare("SELECT operation,state FROM qb_events ORDER BY operation").all();
    assert.equal(pending.length,4);
    assert(pending.every(row=>row.state==='pending'));
    assert.deepEqual(pending.map(row=>row.operation),['deleted','deleted','void','void']);
    const reads=[];
    await runScheduled(env,async(url,init)=>{
      reads.push(new URL(url).pathname);
      assert.equal(init?.method??'GET','GET');
      assert.equal(new URL(url).pathname,'/v3/company/12345/query');
      return Response.json({QueryResponse:{}});
    });
    assert.equal(reads.length,1); // Only the independent reconciliation scan.
    const held=db.sqlite.prepare('SELECT state,reason FROM qb_events').all();
    assert.equal(held.length,4);
    assert(held.every(row=>row.state==='quarantined'&&row.reason==='reversal_review_required'));
    assert.equal(db.sqlite.prepare('SELECT count(*) n FROM conversions').get().n,0);
  } finally {db.sqlite.close();}
});

test('webhook durably separates realms, deduplicates, detects conflicts and rejects forgeries',async()=>{
  const db=database(),env=envFor(db);await active(env);
  const e=event(),foreign=event({intuitaccountid:'999'});
  assert.equal((await webhook(await signed(env,[e,foreign,{malformed:true}]),env)).status,200);
  await webhook(await signed(env,[e,foreign,{malformed:true}]),env);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM qb_events').get().n,3);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM qb_events WHERE state='pending'").get().n,1);
  await webhook(await signed(env,[{...e,intuitentityid:'101'}]),env);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM qb_events WHERE state='conflict'").get().n,1);
  assert.equal((await webhook(new Request(`${env.PUBLIC_ORIGIN}/api/quickbooks/webhook`,{method:'POST',body:'[]'}),env)).status,400);
  db.sqlite.close();
});

test('rejected webhook events stay distinct and keep routing hints across deliveries',async()=>{
  const db=database(),env=envFor(db);await active(env);
  const bad=patch=>({...event({type:'qbo.invoice.merged.v1'}),...patch});
  await webhook(await signed(env,[bad({intuitentityid:'1040'})]),env);
  await webhook(await signed(env,[bad({intuitentityid:'1041'})]),env);
  await webhook(await signed(env,[{malformed:true,intuitaccountid:env.QB_REALM_ID}]),env);
  await webhook(await signed(env,[{malformed:false}]),env);
  const rows=db.sqlite.prepare("SELECT realm_id,entity_id,reason FROM qb_events WHERE state='quarantined' ORDER BY reason,entity_id,realm_id").all();
  assert.deepEqual(rows.map(r=>[r.realm_id,r.entity_id,r.reason]),[
    [null,null,'invalid_event'],[env.QB_REALM_ID,null,'invalid_event'],
    [env.QB_REALM_ID,'1040','unsupported_event'],[env.QB_REALM_ID,'1041','unsupported_event']]);
  db.sqlite.close();
});

test('webhook accepts genuine events without optional fields and large batches',async()=>{
  const db=database(),env=envFor(db);await active(env);
  const {datacontenttype,time,...minimal}=event();
  const many=Array.from({length:150},(_,i)=>event({intuitentityid:String(200+i),intuitaccountid:'999'}));
  assert.equal((await webhook(await signed(env,[minimal,...many]),env)).status,200);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM qb_events WHERE state='pending'").get().n,1);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM qb_events WHERE reason='unauthorized_company'").get().n,150);
  db.sqlite.close();
});

test('authorized-company events during a hold are labeled connection_inactive',async()=>{
  const db=database(),env=envFor(db);await active(env);
  db.sqlite.exec("UPDATE qb_connection SET state='refresh_unknown',paused=1");
  await webhook(await signed(env,[event(),event({intuitaccountid:'999'})]),env);
  assert.deepEqual(db.sqlite.prepare('SELECT realm_id,reason FROM qb_events ORDER BY realm_id').all().map(r=>[r.realm_id,r.reason]),
    [[env.QB_REALM_ID,'connection_inactive'],['999','unauthorized_company']]);
  db.sqlite.close();
});

test('an interrupted renewal past its deadline is held and audited by the scheduler',async()=>{
  const db=database(),env=envFor(db);await active(env);
  db.sqlite.prepare("UPDATE qb_connection SET state='refresh_dispatched',attempt_id='x',attempt_deadline=?").run(Date.now()-1);
  await runScheduled(env,async()=>{throw new Error('no provider call expected');});
  assert.equal(db.sqlite.prepare('SELECT state FROM qb_connection').get().state,'refresh_unknown');
  assert.deepEqual(db.sqlite.prepare('SELECT action FROM qb_audit').all().map(r=>r.action),['refresh_deadline_expired']);
  db.sqlite.close();
});

test('webhook does not acknowledge failed durable storage',async()=>{
  const db=database(),env=envFor(db);await active(env);
  const bad={...env,DB:{prepare(sql){if(sql.startsWith('INSERT INTO qb_events'))throw new Error('synthetic D1 failure');return db.prepare(sql);}}};
  const response=await worker.fetch(await signed(env,[event()]),bad);
  assert.equal(response.status,503);assert(!(await response.text()).includes('synthetic D1 failure'));
  db.sqlite.close();
});

test('shop calendar honors local midnight and 30 dates across both DST changes',()=>{
  assert.deepEqual(shopCalendar('2026-03-08T06:59:59Z','America/New_York'),{date:'2026-03-08',offsetMinutes:-300});
  assert.deepEqual(shopCalendar('2026-03-08T07:00:00Z','America/New_York'),{date:'2026-03-08',offsetMinutes:-240});
  assert.deepEqual(shopCalendar('2026-11-01T05:59:59Z','America/New_York'),{date:'2026-11-01',offsetMinutes:-240});
  assert.deepEqual(shopCalendar('2026-11-01T06:00:00Z','America/New_York'),{date:'2026-11-01',offsetMinutes:-300});
  assert.deepEqual(shopCalendar('2026-01-01T00:00:00Z','America/Los_Angeles'),{date:'2025-12-31',offsetMinutes:-480});
  for(const [created_at,lastDay,expired] of [['2026-03-01T05:00:00Z','2026-03-30','2026-03-31'],['2026-10-15T04:00:00Z','2026-11-13','2026-11-14']]) {
    const lead={id:'fixture',status:'CLAIMED',payout_type:'FIXED',claim_order:1,created_at};
    assert.equal(firstEligibleClaim([lead],lastDay,'America/New_York'),lead);
    assert.equal(firstEligibleClaim([lead],expired,'America/New_York'),null);
    assert.throws(()=>firstEligibleClaim([lead],'2026-02-30','America/New_York'));
    assert.throws(()=>firstEligibleClaim([lead],lastDay,'invalid/zone'));
  }
});

test('SQL fences a credit when authority changes after the final application check',async()=>{
  const db=database(),env=envFor(db);await active(env);
  await worker.fetch(claimRequest(),localEnv(db));
  const lead=db.sqlite.prepare('SELECT * FROM leads').get();
  const binding={realmId:'12345',generation:1,environment:'sandbox'};
  const store=new LocalConversionStore(db,binding);
  const c={id:crypto.randomUUID(),leadId:lead.id,partnerId:lead.partner_id,invoiceId:'100',binding,
    paidCents:8000,rewardCents:2500,policyVersion:POLICY_VERSION,evidenceReference:'synthetic-guard-evidence',
    customerId:'20',customerPhone:lead.customer_phone,customerEmail:lead.customer_email,
    paymentDate:new Date().toISOString().slice(0,10),timeZone:'UTC'};
  await assert.rejects(store.creditOnce(c),/connection_not_authorized|calendar_evidence_mismatch/);
  db.sqlite.prepare('INSERT INTO qb_evidence VALUES (?,?,?,?,?,?)').run(c.evidenceReference,'12345',1,'100',JSON.stringify({paymentDate:c.paymentDate,timeZone:c.timeZone}),Date.now());
  db.sqlite.exec('UPDATE qb_connection SET paused=1');
  await assert.rejects(store.creditOnce(c),/connection_not_authorized|calendar_evidence_mismatch/);
  db.sqlite.exec('UPDATE qb_connection SET paused=0,generation=2');
  await assert.rejects(store.creditOnce(c),/connection_not_authorized|calendar_evidence_mismatch/);
  assert.equal(db.sqlite.prepare('SELECT status FROM leads').get().status,'CLAIMED');
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM conversions').get().n,0);
  db.sqlite.exec('UPDATE qb_connection SET generation=1');
  await assert.rejects(store.creditOnce({...c,timeZone:'America/New_York'}),/calendar_evidence_mismatch/);
  await assert.rejects(store.creditOnce({...c,paymentDate:'2000-01-01'}),/calendar_evidence_mismatch/);
  assert.equal(await store.creditOnce(c),'created');
  db.sqlite.close();
});

test('signed invoice event -> scheduled sandbox reads -> one fixed reward, with atomic connection guard',async()=>{
  const db=database(),env=envFor(db);await active(env);
  await worker.fetch(claimRequest(),localEnv(db));db.sqlite.exec("UPDATE leads SET created_at='2020-01-02T04:59:59.000Z'");
  const data={
    Invoice:{Id:'100',CustomerRef:{value:'20'},CurrencyRef:{value:'USD'},TotalAmt:80,Balance:0,MetaData:{CreateTime:'2020-01-02T00:00:00Z',LastUpdatedTime:'2020-01-20T00:00:00Z'},LinkedTxn:[{TxnType:'Payment',TxnId:'200'}]},
    Payment:{Id:'200',CustomerRef:{value:'20'},CurrencyRef:{value:'USD'},TotalAmt:80,TxnDate:'2020-01-01',Line:[{Amount:80,LinkedTxn:[{TxnType:'Invoice',TxnId:'100'}]}]},
    Customer:{Id:'20',PrimaryPhone:{FreeFormNumber:'2025550124'},PrimaryEmailAddr:{Address:'sample@example.test'}}
  };
  const send=async url=>{
    assert(String(url).startsWith('https://sandbox-quickbooks.api.intuit.com/'));
    for(const entity of ['Invoice','Payment','Customer'])if(String(url).includes(`/${entity.toLowerCase()}/`))return Response.json({[entity]:data[entity]});
    return Response.json({QueryResponse:{}});
  };
  const e=event();await webhook(await signed(env,[e]),env);
  await runScheduled(env,send);
  const c=db.sqlite.prepare('SELECT * FROM conversions').get();assert.equal(c.reward_amount_cents,2500);assert.equal(c.connection_generation,1);
  assert.equal(c.payment_date,'2020-01-01');assert.equal(c.claim_local_date,'2020-01-01');assert.equal(c.paid_at,null);
  assert.equal(db.sqlite.prepare('SELECT state FROM qb_events').get().state,'done');
  assert.equal(db.sqlite.prepare('SELECT reason FROM qb_events').get().reason,'conversion_created');
  await webhook(await signed(env,[e]),env);await runScheduled(env,send);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM conversions').get().n,1);
  // A different pending record cannot bypass a changed connection generation.
  const reader=new SandboxReader(env,send);
  db.sqlite.exec('UPDATE qb_connection SET generation=2');
  await assert.rejects(reader.assertAuthorized({realmId:'12345',generation:1,environment:'sandbox'}));
  db.sqlite.close();
});

test('reconciliation revisits mutable outcomes on a bounded cadence',async()=>{
  const db=database(),env=envFor(db);await active(env);
  try {
    await webhook(await signed(env,[event()]),env);
    const send=async url=>{
      if(String(url).includes('/invoice/100'))return Response.json({Invoice:{Id:'100',CustomerRef:{value:'20'},CurrencyRef:{value:'USD'},TotalAmt:80,Balance:80,MetaData:{CreateTime:'2026-10-09T00:00:00Z',LastUpdatedTime:'2026-10-09T00:00:00Z'},LinkedTxn:[]}});
      return Response.json({QueryResponse:{Invoice:[{Id:'100'}]}});
    };
    await runScheduled(env,send);
    const observed=db.sqlite.prepare("SELECT state,reason,attempts FROM qb_events WHERE reason='invoice_unpaid'").get();
    assert.deepEqual({...observed},{state:'done',reason:'invoice_unpaid',attempts:1});
    assert.equal(db.sqlite.prepare("SELECT count(*) n FROM qb_events WHERE state='pending'").get().n,1);
    await runScheduled(env,send);
    const scan=db.sqlite.prepare("SELECT state,reason,available_at FROM qb_events WHERE digest=event_key").get();
    assert.equal(scan.state,'done');assert.equal(scan.reason,'invoice_unpaid');assert(scan.available_at>Date.now());
    assert.equal(db.sqlite.prepare("SELECT count(*) n FROM qb_events WHERE state='pending'").get().n,0);
    db.sqlite.prepare("UPDATE qb_events SET available_at=0 WHERE digest=event_key").run();
    await runScheduled(env,send);
    assert.equal(db.sqlite.prepare("SELECT state FROM qb_events WHERE digest=event_key").get().state,'pending');
    assert.equal(db.sqlite.prepare('SELECT count(*) n FROM conversions').get().n,0);
  } finally {db.sqlite.close();}
});
