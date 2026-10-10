import { normalizeEmail, normalizePhone } from '../validation.ts';
import { cents, fixedRewardCents } from './money.ts';
import { firstEligibleClaim, POLICY_VERSION } from './policy.ts';
import type { AuthorizedQboReader, Binding, ConversionStore } from './contracts.ts';

/** All evidence must come through the authorized server-side reader contract. */
export async function processInvoice(
  binding: Binding, invoiceId: string,
  deps: { qbo: AuthorizedQboReader; store: ConversionStore }
): Promise<'created' | 'duplicate' | 'held' | 'unpaid' | 'unmatched' | 'ineligible'> {
  const { qbo, store } = deps;
  if (!/^\d{1,30}$/.test(binding.realmId) || !/^\d{1,30}$/.test(invoiceId) ||
      !['sandbox','production'].includes(binding.environment) || !Number.isSafeInteger(binding.generation) || binding.generation < 1) {
    throw new Error('invalid_context');
  }
  await qbo.assertAuthorized(binding);
  const invoice = await qbo.readInvoice(binding, invoiceId);
  if (invoice.Id !== invoiceId || invoice.CurrencyRef?.value !== 'USD' || !/^\d{1,30}$/.test(invoice.CustomerRef?.value)) return 'held';
  const total = cents(invoice.TotalAmt);
  if (total === 0 || cents(invoice.Balance) !== 0) return 'unpaid';
  // A settled balance alone may be credits rather than actual payment.
  const links = invoice.LinkedTxn ?? [];
  if (!links.length || links.some(link => link.TxnType !== 'Payment')) return 'held';
  const paymentIds = [...new Set(links.map(link => link.TxnId))];
  if (paymentIds.length > 50 || paymentIds.some(id => !/^\d{1,30}$/.test(id))) return 'held';
  const payments = [];
  let allocated = 0;
  for (const id of paymentIds) {
    await qbo.assertAuthorized(binding);
    const payment = await qbo.readPayment(binding, id);
    if (payment.Id !== id || payment.CustomerRef?.value !== invoice.CustomerRef.value || payment.CurrencyRef?.value !== 'USD') return 'held';
    let allAllocations = 0;
    for (const line of payment.Line) {
      const amount = cents(line.Amount);
      allAllocations += amount;
      const matches = line.LinkedTxn.filter(link => link.TxnType === 'Invoice' && link.TxnId === invoiceId);
      if (matches.length) {
        // Multi-target line amounts cannot be unambiguously attributed here.
        if (line.LinkedTxn.length !== 1) return 'held';
        allocated += amount;
      }
    }
    if (allAllocations > cents(payment.TotalAmt)) return 'held';
    payments.push(payment);
  }
  if (allocated !== total) return 'held';
  await qbo.assertAuthorized(binding);
  const customer = await qbo.readCustomer(binding, invoice.CustomerRef.value);
  if (customer.Id !== invoice.CustomerRef.value) return 'held';
  const primary = normalizePhone(customer.PrimaryPhone?.FreeFormNumber);
  const mobile = normalizePhone(customer.Mobile?.FreeFormNumber);
  // Do not silently choose one of two different customer phone identities.
  if (primary && mobile && primary !== mobile) return 'held';
  const phone = primary ?? mobile;
  const email = normalizeEmail(customer.PrimaryEmailAddr?.Address);
  if (!phone && !email) return 'unmatched';
  const candidates = await store.findCandidates(phone, email);
  // Email fallback only if QBO provides no usable phone. Matching a supplied
  // different phone through a shared email is an ambiguous identity, not proof.
  if (phone && candidates.some(lead => lead.customer_phone !== phone)) return 'held';
  if (!phone && new Set(candidates.map(lead => lead.customer_phone)).size > 1) return 'held';
  if (!candidates.length) return 'unmatched';
  const evidence = await qbo.retainEvidence(binding, invoice, payments);
  if (!evidence?.reference) return 'held';
  let lead;
  try { lead = firstEligibleClaim(candidates,evidence.paymentDate,evidence.timeZone); }
  catch { return 'held'; }
  if (!lead) return 'ineligible';
  const reward = fixedRewardCents(lead.payout_value_units);
  await qbo.assertAuthorized(binding);
  return store.creditOnce({ id: crypto.randomUUID(), leadId: lead.id, partnerId: lead.partner_id,
    invoiceId, binding, paidCents: allocated, rewardCents: reward,
    customerId: customer.Id, customerPhone: lead.customer_phone, customerEmail: lead.customer_email,
    paymentDate:evidence.paymentDate,timeZone:evidence.timeZone,
    policyVersion: POLICY_VERSION, evidenceReference: evidence.reference });
}
