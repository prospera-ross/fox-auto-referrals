import type { Lead } from './contracts.ts';

export const POLICY_VERSION = 'fox-fixed-first-30-calendar-days-v2';
export const CLAIM_VALIDITY_DAYS = 30;

export function calendarDayNumber(date: string): number {
  const instant = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(instant) ||
      new Date(instant).toISOString().slice(0,10) !== date) throw new Error('invalid_payment_date');
  return instant / 86400000;
}

/** Resolve the shop date and actual offset at the claim instant (including DST).
 * D1 can recheck the date against this offset; IANA resolution lives in Workers. */
export function shopCalendar(instant: string, timeZone: string): { date: string; offsetMinutes: number } {
  const utc = Date.parse(instant);
  if (!Number.isFinite(utc) || !timeZone) throw new Error('invalid_shop_date');
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone,
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(utc)).map(p => [p.type,p.value]));
  const local = Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second));
  const offsetMinutes = (local - Math.floor(utc / 1000) * 1000) / 60000;
  if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes)>840) throw new Error('invalid_shop_offset');
  return { date:`${p.year}-${p.month}-${p.day}`, offsetMinutes };
}

/** First claim is permanent attribution; later claims never restart the window.
 * The claim's shop-local date is day 1; day 30 is included, day 31 excluded.
 * Eligibility uses the payment accounting date, never event delivery time.
 */
export function firstEligibleClaim(leads: Lead[], paymentDate: string, timeZone: string): Lead | null {
  const paid = calendarDayNumber(paymentDate);
  if (!leads.length || leads.some(lead => !Number.isFinite(Date.parse(lead.created_at)))) return null;
  const first = [...leads].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.claim_order - b.claim_order)[0];
  const claimed = calendarDayNumber(shopCalendar(first.created_at,timeZone).date);
  if (first.status !== 'CLAIMED' || first.payout_type !== 'FIXED' || paid < claimed || paid >= claimed + CLAIM_VALIDITY_DAYS) return null;
  return first;
}
