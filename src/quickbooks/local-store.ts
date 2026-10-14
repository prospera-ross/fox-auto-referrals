import type { Binding, Conversion, ConversionStore, Lead } from './contracts.ts';
import { shopCalendar } from './policy.ts';

/** D1 ledger adapter. Sandbox jobs MUST pass Binding, which activates migration
 * 0003's atomic generation/pause/evidence guard. The string mode is fixture-only.
 * The legacy class name is retained for the existing core tests. */
export class LocalConversionStore implements ConversionStore {
  private db: D1Database;
  private binding?: Binding;
  constructor(db: D1Database, mode: 'synthetic-local' | Binding) {
    if (mode !== 'synthetic-local') {
      if (mode.environment !== 'sandbox') throw new Error('sandbox_only');
      this.binding=mode;
    }
    this.db = db;
  }
  async findCandidates(phone: string | null, email: string | null): Promise<Lead[]> {
    const rows = await this.db.prepare(`SELECT id, partner_id, customer_phone, customer_email, status, rowid AS claim_order,
      created_at, payout_type, payout_value_units FROM leads
      WHERE customer_phone = ? OR customer_email = ?
      ORDER BY created_at, rowid LIMIT 101`).bind(phone, email).all<Lead>();
    if (rows.results.length > 100) throw new Error('ambiguous_contact');
    return rows.results;
  }
  async creditOnce(c: Conversion): Promise<'created' | 'duplicate' | 'held'> {
    if (c.binding.environment !== 'sandbox') throw new Error('local_only');
    if(this.binding && (c.binding.realmId!==this.binding.realmId || c.binding.generation!==this.binding.generation))throw new Error('binding_mismatch');
    const lead = await this.db.prepare('SELECT created_at FROM leads WHERE id = ?').bind(c.leadId).first<{created_at:string}>();
    if (!lead) return 'held';
    const claimCalendar = shopCalendar(lead.created_at,c.timeZone);
    // INSERT SELECT serializes the checks and write. The completion trigger runs
    // only for a real inserted row. Unique constraints survive concurrent callers.
    const result = await this.db.prepare(`INSERT INTO conversions
      (id, lead_id, partner_id, quickbooks_invoice_id, quickbooks_realm_id,
       provider_environment, amount_paid_cents, reward_amount_cents, policy_version, evidence_reference,
       quickbooks_customer_id, customer_phone, customer_email, payment_date, shop_time_zone,
       claim_local_date, claim_utc_offset_minutes, connection_generation)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM leads WHERE id = ? AND partner_id = ? AND status = 'CLAIMED')
      AND NOT EXISTS (SELECT 1 FROM conversions WHERE lead_id = ? OR
        (provider_environment = ? AND quickbooks_realm_id = ? AND
          (quickbooks_invoice_id = ? OR quickbooks_customer_id = ? OR customer_phone = ? OR customer_email = ?)))`).bind(
      c.id, c.leadId, c.partnerId, c.invoiceId, c.binding.realmId, c.binding.environment,
      c.paidCents, c.rewardCents, c.policyVersion, c.evidenceReference,
      c.customerId, c.customerPhone, c.customerEmail, c.paymentDate, c.timeZone,
      claimCalendar.date, claimCalendar.offsetMinutes, this.binding?.generation ?? null,
      c.leadId, c.partnerId, c.leadId, c.binding.environment, c.binding.realmId, c.invoiceId,
      c.customerId, c.customerPhone, c.customerEmail
    ).run();
    if (result.meta.changes > 0) return 'created';
    const existing = await this.db.prepare(`SELECT lead_id FROM conversions
      WHERE provider_environment = ? AND quickbooks_realm_id = ? AND quickbooks_invoice_id = ?`)
      .bind(c.binding.environment, c.binding.realmId, c.invoiceId).first<{ lead_id: string }>();
    return existing?.lead_id === c.leadId ? 'duplicate' : 'held';
  }
  async creditedLead(binding: Binding, invoiceId: string): Promise<string | null> {
    const row = await this.db.prepare(`SELECT lead_id FROM conversions
      WHERE provider_environment = ? AND quickbooks_realm_id = ? AND quickbooks_invoice_id = ?`)
      .bind(binding.environment, binding.realmId, invoiceId).first<{ lead_id: string }>();
    return row?.lead_id ?? null;
  }
}
