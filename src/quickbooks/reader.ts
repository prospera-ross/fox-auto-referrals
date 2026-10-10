import { readBody } from '../http.ts';
import { connection, configured } from './env.ts';
import type { QbEnv } from './env.ts';
import { getAccessToken } from './tokens.ts';
import type { Fetcher } from './tokens.ts';
import type { AuthorizedQboReader, Binding, Invoice, Payment, Customer } from './contracts.ts';
import { calendarDayNumber, shopCalendar } from './policy.ts';

export async function providerJson(env: QbEnv, path: string, token: string, send: Fetcher = fetch): Promise<Record<string,unknown>> {
  // The path is constructed only by the adapters below, never passed from an HTTP client.
  const url = new URL(`https://sandbox-quickbooks.api.intuit.com/v3/company/${env.QB_REALM_ID}/${path}`);
  url.searchParams.set('minorversion',env.QB_MINOR_VERSION!);
  // Do not follow provider redirects; Workers manual mode exposes the response
  // reliably while redirect:'error' can throw before returning it.
  const response = await send(url.href,{ headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(15000) });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401) throw new Error('provider_unauthorized');
    throw new Error('provider_read_failed');
  }
  const bytes = await readBody(new Request('https://response.invalid',{method:'POST',body:response.body,duplex:'half'} as RequestInit),2*1024*1024);
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid_provider_response');
  return data as Record<string,unknown>;
}

const object = (v: unknown): Record<string,any> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('invalid_entity');
  return v as Record<string,any>;
};
const id = (v: unknown): string => { if (typeof v !== 'string' || !/^\d{1,30}$/.test(v)) throw new Error('invalid_entity_id'); return v; };
function links(v: unknown): { TxnId:string;TxnType:string }[] {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length>100) throw new Error('invalid_links');
  return v.map(raw=> { const x=object(raw); if(typeof x.TxnType!=='string')throw new Error('invalid_link');return {TxnId:id(x.TxnId),TxnType:x.TxnType}; });
}

export class SandboxReader implements AuthorizedQboReader {
  private env: QbEnv; private send: Fetcher;
  constructor(env: QbEnv, send: Fetcher = fetch) { this.env=env;this.send=send; }
  async assertAuthorized(binding: Binding): Promise<void> {
    configured(this.env);
    const c = await connection(this.env);
    if (binding.environment!=='sandbox' || c.realm_id!==binding.realmId || c.realm_id!==this.env.QB_REALM_ID ||
        c.generation!==binding.generation || c.state!=='active' || c.paused) throw new Error('connection_inactive');
  }
  async read(binding: Binding, path: string): Promise<Record<string,unknown>> {
    await this.assertAuthorized(binding);
    const token=await getAccessToken(this.env,binding.generation,this.send);
    await this.assertAuthorized(binding);
    return providerJson(this.env,path,token,this.send);
  }
  async readInvoice(binding: Binding, entityId: string): Promise<Invoice> {
    const x=object((await this.read(binding,`invoice/${id(entityId)}`)).Invoice);
    if(id(x.Id)!==entityId)throw new Error('invoice_mismatch');
    return {Id:x.Id,CustomerRef:{value:id(object(x.CustomerRef).value)},CurrencyRef:{value:String(object(x.CurrencyRef).value)},
      TotalAmt:x.TotalAmt,Balance:x.Balance,MetaData:object(x.MetaData) as Invoice['MetaData'],LinkedTxn:links(x.LinkedTxn)};
  }
  async readPayment(binding: Binding, entityId: string): Promise<Payment> {
    const x=object((await this.read(binding,`payment/${id(entityId)}`)).Payment);
    if(id(x.Id)!==entityId || !Array.isArray(x.Line) || x.Line.length>100)throw new Error('payment_mismatch');
    return {Id:x.Id,CustomerRef:{value:id(object(x.CustomerRef).value)},CurrencyRef:{value:String(object(x.CurrencyRef).value)},
      TotalAmt:x.TotalAmt,TxnDate:x.TxnDate,Line:x.Line.map((raw:unknown)=>{const line=object(raw);return {Amount:line.Amount,LinkedTxn:links(line.LinkedTxn)};})};
  }
  async readCustomer(binding: Binding, entityId: string): Promise<Customer> {
    const x=object((await this.read(binding,`customer/${id(entityId)}`)).Customer);
    if(id(x.Id)!==entityId)throw new Error('customer_mismatch');
    const contact=(v:unknown,key:string)=>v===undefined?undefined:String(object(v)[key]??'').slice(0,254);
    const phone=contact(x.PrimaryPhone,'FreeFormNumber'),mobile=contact(x.Mobile,'FreeFormNumber'),email=contact(x.PrimaryEmailAddr,'Address');
    return {Id:x.Id,PrimaryPhone:phone?{FreeFormNumber:phone}:undefined,Mobile:mobile?{FreeFormNumber:mobile}:undefined,PrimaryEmailAddr:email?{Address:email}:undefined};
  }
  async retainEvidence(binding: Binding, invoice: Invoice, payments: Payment[]) {
    await this.assertAuthorized(binding);
    if(!this.env.QB_TIME_ZONE || payments.some(p=>typeof p.TxnDate!=='string'))return null;
    // Validate every allocation date, not just the lexicographically latest one.
    try { payments.forEach(p=>calendarDayNumber(p.TxnDate!)); } catch { return null; }
    const day=payments.map(p=>p.TxnDate!).sort().at(-1);
    if(!day)return null;
    if(day>shopCalendar(new Date().toISOString(),this.env.QB_TIME_ZONE).date)return null;
    const reference=crypto.randomUUID();
    // Retain minimal monetary/link evidence, no customer PII or credentials.
    await this.env.DB.prepare(`INSERT INTO qb_evidence(id,realm_id,generation,invoice_id,payload,created_at)
      SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM qb_connection WHERE id=1 AND state='active' AND paused=0 AND generation=? AND realm_id=?)`)
      .bind(reference,binding.realmId,binding.generation,invoice.Id,JSON.stringify({invoice,payments,paymentDate:day,timeZone:this.env.QB_TIME_ZONE}),Date.now(),binding.generation,binding.realmId).run();
    return {reference,paymentDate:day,timeZone:this.env.QB_TIME_ZONE};
  }
}
