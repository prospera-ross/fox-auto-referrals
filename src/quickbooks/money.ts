const MAX_CENTS = 100_000_000; // Prototype safety ceiling, not an approved business limit.

/** Parse decimal values without multiplying binary floating-point money. */
export function cents(value: unknown): number {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== 'string' || !/^\d{1,7}(\.\d{1,2})?$/.test(text)) throw new Error('invalid_money');
  const [whole, fraction = ''] = text.split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result > BigInt(MAX_CENTS)) throw new Error('money_limit');
  return Number(result);
}

export function fixedRewardCents(units: number): number {
  if (!Number.isSafeInteger(units) || units < 0 || units > MAX_CENTS) throw new Error('invalid_reward');
  return units;
}
