import { HttpError } from '../http.ts';
import type { QbEnv } from '../quickbooks/env.ts';

type LedgerKind = 'leads' | 'commissions';

type Filters = {
  page:number; limit:number; offset:number; partnerId:string|null;
  status:string|null; from:string|null; until:string|null;
};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDate(value:string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date=new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10)===value;
}

function nextDate(value:string): string {
  const date=new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate()+1);
  return date.toISOString().slice(0,10);
}

function filters(url:URL,kind:LedgerKind): Filters {
  const pageRaw=url.searchParams.get('page')??'1',limitRaw=url.searchParams.get('limit')??'25';
  if (!/^\d+$/.test(pageRaw)||!/^\d+$/.test(limitRaw)) throw new HttpError(400,'INVALID_PAGE','Use a valid page and limit.');
  const page=Number(pageRaw),limit=Number(limitRaw);
  if (!Number.isSafeInteger(page)||page<1||page>10000||!Number.isSafeInteger(limit)||limit<1||limit>100) {
    throw new HttpError(400,'INVALID_PAGE','Use a valid page and limit.');
  }
  const partnerId=url.searchParams.get('partner_id');
  if (partnerId!==null && !UUID.test(partnerId)) throw new HttpError(400,'INVALID_FILTER','Choose a valid partner.');
  const status=url.searchParams.get('status');
  const allowed=kind==='leads'?['CLAIMED','COMPLETED','EXPIRED']:['PENDING','PAID'];
  if (status!==null && !allowed.includes(status)) throw new HttpError(400,'INVALID_FILTER','Choose a valid status.');
  const from=url.searchParams.get('date_from'),to=url.searchParams.get('date_to');
  if ((from!==null&&!validDate(from))||(to!==null&&!validDate(to))||(from!==null&&to!==null&&from>to)) {
    throw new HttpError(400,'INVALID_FILTER','Choose a valid date range.');
  }
  return {page,limit,offset:(page-1)*limit,partnerId,status,from,until:to?nextDate(to):null};
}

function where(alias:string,input:Filters): {sql:string; values:unknown[]} {
  const clauses:string[]=[],values:unknown[]=[];
  if (input.partnerId) { clauses.push(`${alias}.partner_id=?`); values.push(input.partnerId); }
  if (input.status) { clauses.push(`${alias}.status=?`); values.push(input.status); }
  if (input.from) { clauses.push(`${alias}.created_at>=?`); values.push(`${input.from}T00:00:00.000Z`); }
  if (input.until) { clauses.push(`${alias}.created_at<?`); values.push(`${input.until}T00:00:00.000Z`); }
  return {sql:clauses.length?` WHERE ${clauses.join(' AND ')}`:'',values};
}

type LeadRow = {
  id:string; customer_name:string; customer_phone:string; customer_email:string|null; status:string;
  created_at:string; reward_amount_cents:number; partner_id:string; partner_name:string; referral_code:string;
  commission_status:string|null; commission_amount_cents:number|null; invoice_id:string|null; payment_date:string|null;
};

type CommissionRow = {
  id:string; lead_id:string; customer_name:string; customer_phone:string; customer_email:string|null;
  partner_id:string; partner_name:string; referral_code:string; invoice_id:string; amount_paid_cents:number;
  reward_amount_cents:number; status:string; payment_date:string|null; created_at:string;
};

export async function leadLedger(url:URL,env:QbEnv): Promise<Record<string,unknown>> {
  const input=filters(url,'leads'),condition=where('l',input);
  const rows=await env.DB.prepare(`SELECT l.id,l.customer_name,l.customer_phone,l.customer_email,l.status,l.created_at,
      l.payout_value_units AS reward_amount_cents,p.id AS partner_id,p.name AS partner_name,p.referral_code,
      c.status AS commission_status,c.reward_amount_cents AS commission_amount_cents,
      c.quickbooks_invoice_id AS invoice_id,c.payment_date
    FROM leads l JOIN partners p ON p.id=l.partner_id LEFT JOIN conversions c ON c.lead_id=l.id
    ${condition.sql} ORDER BY l.created_at DESC,l.id DESC LIMIT ? OFFSET ?`)
    .bind(...condition.values,input.limit,input.offset).all<LeadRow>();
  const count=await env.DB.prepare(`SELECT count(*) AS total FROM leads l${condition.sql}`)
    .bind(...condition.values).first<{total:number}>();
  return {leads:rows.results,page:input.page,limit:input.limit,total:count?.total??0};
}

export async function commissionLedger(url:URL,env:QbEnv): Promise<Record<string,unknown>> {
  const input=filters(url,'commissions'),condition=where('c',input);
  const rows=await env.DB.prepare(`SELECT c.id,c.lead_id,l.customer_name,l.customer_phone,l.customer_email,
      p.id AS partner_id,p.name AS partner_name,p.referral_code,c.quickbooks_invoice_id AS invoice_id,
      c.amount_paid_cents,c.reward_amount_cents,c.status,c.payment_date,c.created_at
    FROM conversions c JOIN leads l ON l.id=c.lead_id JOIN partners p ON p.id=c.partner_id
    ${condition.sql} ORDER BY c.created_at DESC,c.id DESC LIMIT ? OFFSET ?`)
    .bind(...condition.values,input.limit,input.offset).all<CommissionRow>();
  const totals=await env.DB.prepare(`SELECT count(*) AS total,coalesce(sum(c.amount_paid_cents),0) AS amount_paid_cents,
      coalesce(sum(c.reward_amount_cents),0) AS reward_amount_cents FROM conversions c${condition.sql}`)
    .bind(...condition.values).first<{total:number;amount_paid_cents:number;reward_amount_cents:number}>();
  return {commissions:rows.results,page:input.page,limit:input.limit,total:totals?.total??0,
    totals:{amount_paid_cents:totals?.amount_paid_cents??0,reward_amount_cents:totals?.reward_amount_cents??0}};
}
