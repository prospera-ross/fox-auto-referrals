export interface Binding {
  realmId: string;
  environment: 'sandbox' | 'production';
  generation: number;
}
export interface Reference { value: string }
export interface Link { TxnId: string; TxnType: string }
export interface Invoice {
  Id: string; CustomerRef: Reference; TotalAmt: string | number; Balance: string | number;
  CurrencyRef: Reference; MetaData: { CreateTime: string; LastUpdatedTime: string };
  LinkedTxn?: Link[];
}
export interface Payment {
  TxnDate?: string;
  Id: string; CustomerRef: Reference; CurrencyRef: Reference;
  TotalAmt: string | number;
  Line: { Amount: string | number; LinkedTxn: Link[] }[];
}
export interface Customer {
  Id: string; PrimaryPhone?: { FreeFormNumber: string };
  Mobile?: { FreeFormNumber: string }; PrimaryEmailAddr?: { Address: string };
}
export interface Lead {
  id: string; partner_id: string; customer_phone: string; customer_email: string | null;
  status: 'CLAIMED' | 'COMPLETED' | 'EXPIRED'; claim_order: number;
  created_at: string; payout_type: 'FIXED' | 'PERCENTAGE'; payout_value_units: number;
}

/** Server-only port. It must validate raw QBO JSON, current binding, IDs/company,
 * detect
 * voids/deletions/refunds and persist protected evidence. No browser-supplied
 * snapshot or merely successful HTTP status may satisfy this contract.
 */
export interface AuthorizedQboReader {
  assertAuthorized(binding: Binding): Promise<void>;
  readInvoice(binding: Binding, id: string): Promise<Invoice>;
  readCustomer(binding: Binding, id: string): Promise<Customer>;
  readPayment(binding: Binding, id: string): Promise<Payment>;
  /** Latest allocated Payment.TxnDate and the configured shop IANA timezone.
   * This is an accounting date, never a fabricated exact payment timestamp. */
  retainEvidence(binding: Binding, invoice: Invoice, payments: Payment[]): Promise<{ reference: string; paymentDate: string; timeZone: string } | null>;
}

export interface Conversion {
  id: string; leadId: string; partnerId: string; invoiceId: string;
  binding: Binding; paidCents: number; rewardCents: number;
  customerId: string; customerPhone: string; customerEmail: string | null; paymentDate: string; timeZone: string;
  policyVersion: string; evidenceReference: string;
}
export interface ConversionStore {
  // Include completed/expired history so later claims cannot steal attribution.
  findCandidates(phone: string | null, email: string | null): Promise<Lead[]>;
  /** Production adapter must atomically recheck current binding generation and
   * pause state alongside deduplicated insertion; no check/send race waiver. */
  creditOnce(conversion: Conversion): Promise<'created' | 'duplicate' | 'held'>;
  /** Lead already credited for this exact provider invoice, if any. */
  creditedLead(binding: Binding, invoiceId: string): Promise<string | null>;
}
