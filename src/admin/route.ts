import { HttpError, json, readBody } from '../http.ts';
import { requireAdmin } from '../quickbooks/admin.ts';
import type { QbEnv } from '../quickbooks/env.ts';
import { validatePartnerCreate, validatePartnerUpdate } from './validation.ts';
import { commissionLedger, leadLedger } from './ledger.ts';
import QRCode from 'qrcode';
import { dashboard } from './dashboard-page.ts';

type Authenticator = (request: Request, env: QbEnv) => Promise<string>;
type PartnerRow = {
  id:string; name:string; phone:string; referral_code:string;
  payout_value_units:number; active:number; created_at:string; updated_at:string; version:number;
};

const authenticate: Authenticator = (request,env) => requireAdmin(request,env,undefined,env.ADMIN_ACCESS_AUD);
const partnerJson = (row: PartnerRow) => ({
  id:row.id,name:row.name,phone:row.phone,referral_code:row.referral_code,
  reward_amount_cents:row.payout_value_units,active:row.active===1,
  created_at:row.created_at,updated_at:row.updated_at,version:row.version
});

async function body(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) {
    throw new HttpError(415,'UNSUPPORTED_MEDIA_TYPE','Send JSON partner details.');
  }
  try { return JSON.parse(new TextDecoder().decode(await readBody(request,8192))); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400,'INVALID_JSON','Send valid JSON partner details.');
  }
}

function origin(request: Request, env: QbEnv) {
  if (request.headers.get('Origin') !== env.PUBLIC_ORIGIN) {
    throw new HttpError(403,'INVALID_ORIGIN','Use the protected dashboard to make changes.');
  }
}

export async function adminRoute(request: Request, env: QbEnv, admin: Authenticator = authenticate): Promise<Response> {
  const actor=await admin(request,env);
  const url=new URL(request.url),path=url.pathname;
  if (path==='/api/admin/dashboard' && request.method==='GET') return dashboard();
  if (path==='/api/admin/overview' && request.method==='GET') {
    const row=await env.DB.prepare(`SELECT
      (SELECT count(*) FROM partners) AS partners,
      (SELECT count(*) FROM partners WHERE active=1) AS active_partners,
      (SELECT count(*) FROM leads WHERE status='CLAIMED') AS open_leads,
      (SELECT count(*) FROM conversions WHERE status='PENDING') AS pending_commissions,
      (SELECT coalesce(sum(reward_amount_cents),0) FROM conversions WHERE status='PENDING') AS pending_reward_cents`).first();
    return json({overview:row});
  }
  if (path==='/api/admin/leads' && request.method==='GET') return json(await leadLedger(url,env));
  if (path==='/api/admin/commissions' && request.method==='GET') return json(await commissionLedger(url,env));
  if (path==='/api/admin/partners' && request.method==='GET') {
    const pageRaw=url.searchParams.get('page')??'1',limitRaw=url.searchParams.get('limit')??'50';
    if (!/^\d+$/.test(pageRaw)||!/^\d+$/.test(limitRaw)) throw new HttpError(400,'INVALID_PAGE','Use a valid page and limit.');
    const page=Number(pageRaw),limit=Number(limitRaw);
    if (!Number.isSafeInteger(page)||page<1||page>10000||!Number.isSafeInteger(limit)||limit<1||limit>100) {
      throw new HttpError(400,'INVALID_PAGE','Use a valid page and limit.');
    }
    const rows=await env.DB.prepare(`SELECT id,name,phone,referral_code,payout_value_units,active,created_at,updated_at,version
      FROM partners ORDER BY active DESC,name COLLATE NOCASE,id LIMIT ? OFFSET ?`).bind(limit,(page-1)*limit).all<PartnerRow>();
    const count=await env.DB.prepare('SELECT count(*) AS total FROM partners').first<{total:number}>();
    return json({partners:rows.results.map(row=>({...partnerJson(row),claim_url:`${env.PUBLIC_ORIGIN}/claim?ref=${row.referral_code}`})),page,limit,total:count?.total??0});
  }
  if (path==='/api/admin/partners' && request.method==='POST') {
    origin(request,env);
    const input=validatePartnerCreate(await body(request));
    const id=crypto.randomUUID(),auditId=crypto.randomUUID(),now=new Date().toISOString();
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO partners(id,name,phone,referral_code,payout_type,payout_value_units,active,updated_at,version)
          VALUES (?,?,? ,?,'FIXED',?,1,?,1)`).bind(id,input.name,input.phone,input.referralCode,input.rewardCents,now),
        env.DB.prepare(`INSERT INTO admin_audit(id,actor_sub,action,target_type,target_id,changed_fields,created_at)
          VALUES (?,?,'partner_created','partner',?,'["name","phone","referral_code","reward_amount_cents","active"]',?)`).bind(auditId,actor,id,now)
      ]);
    } catch { throw new HttpError(409,'PARTNER_CONFLICT','That phone number or referral code is already registered.'); }
    const row=await env.DB.prepare(`SELECT id,name,phone,referral_code,payout_value_units,active,created_at,updated_at,version FROM partners WHERE id=?`).bind(id).first<PartnerRow>();
    return json({partner:{...partnerJson(row!),claim_url:`${env.PUBLIC_ORIGIN}/claim?ref=${input.referralCode}`}},201);
  }
  const qrMatch=path.match(/^\/api\/admin\/partners\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/qr\.svg$/i);
  if (qrMatch && request.method==='GET') {
    const row=await env.DB.prepare('SELECT name,referral_code FROM partners WHERE id=?').bind(qrMatch[1]).first<{name:string;referral_code:string}>();
    if (!row) throw new HttpError(404,'PARTNER_NOT_FOUND','Partner not found.');
    const target=`${env.PUBLIC_ORIGIN}/claim?ref=${row.referral_code}`;
    const svg=await QRCode.toString(target,{type:'svg',errorCorrectionLevel:'H',margin:4,color:{dark:'#16334aff',light:'#ffffffff'}});
    const headers=new Headers({'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    if (url.searchParams.get('download')==='1') headers.set('Content-Disposition',`attachment; filename="fox-referral-${row.referral_code}.svg"`);
    return new Response(svg,{headers});
  }
  const match=path.match(/^\/api\/admin\/partners\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/);
  if (match && request.method==='PATCH') {
    origin(request,env);
    const input=validatePartnerUpdate(await body(request));
    const changed=Object.keys(input).filter(key=>key!=='version').sort();
    const now=new Date().toISOString(),next=input.version+1;
    let result;
    try {
      result=await env.DB.batch([
        env.DB.prepare(`UPDATE partners SET name=coalesce(?,name),phone=coalesce(?,phone),
          payout_value_units=coalesce(?,payout_value_units),active=coalesce(?,active),updated_at=?,version=version+1
          WHERE id=? AND version=?`).bind(input.name??null,input.phone??null,input.rewardCents??null,input.active===undefined?null:Number(input.active),now,match[1],input.version),
        env.DB.prepare(`INSERT INTO admin_audit(id,actor_sub,action,target_type,target_id,changed_fields,created_at)
          SELECT ?,?,'partner_updated','partner',?,?,? WHERE EXISTS
          (SELECT 1 FROM partners WHERE id=? AND version=? AND updated_at=?)`).bind(crypto.randomUUID(),actor,match[1],JSON.stringify(changed),now,match[1],next,now)
      ]);
    } catch { throw new HttpError(409,'PARTNER_CONFLICT','That phone number is already registered.'); }
    if (!result[0]?.meta?.changes) {
      const exists=await env.DB.prepare('SELECT id FROM partners WHERE id=?').bind(match[1]).first();
      throw new HttpError(exists?409:404,exists?'STALE_PARTNER':'PARTNER_NOT_FOUND',exists?'Reload this partner before saving changes.':'Partner not found.');
    }
    const row=await env.DB.prepare(`SELECT id,name,phone,referral_code,payout_value_units,active,created_at,updated_at,version FROM partners WHERE id=?`).bind(match[1]).first<PartnerRow>();
    return json({partner:{...partnerJson(row!),claim_url:`${env.PUBLIC_ORIGIN}/claim?ref=${row!.referral_code}`}});
  }
  throw new HttpError(405,'METHOD_NOT_ALLOWED','Unsupported dashboard action.');
}
