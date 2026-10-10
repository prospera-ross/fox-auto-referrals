import { HttpError } from './http.ts';

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 32 || !/^[+()\d\s.-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  // NANP syntax; this does not prove country, ownership or reachability.
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? `+1${digits}` : null;
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export interface ClaimInput {
  ref: string; customer_name: string; customer_phone: string; customer_email: string | null;
}

export function validateClaim(value: unknown): ClaimInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'INVALID_INPUT', 'Enter your contact details.');
  }
  const input = value as Record<string, unknown>;
  const allowed = ['ref', 'customer_name', 'customer_phone', 'customer_email'];
  if (Object.keys(input).some(key => !allowed.includes(key))) {
    throw new HttpError(400, 'INVALID_INPUT', 'The form contains unsupported fields.');
  }
  if (typeof input.ref !== 'string' || !/^[a-z0-9-]{1,64}$/.test(input.ref)) {
    throw new HttpError(400, 'INVALID_REFERRAL', 'Open the link from your offer card again.');
  }
  const name = typeof input.customer_name === 'string' ? input.customer_name.trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new HttpError(400, 'INVALID_NAME', 'Enter your full name (up to 120 characters).');
  }
  const phone = normalizePhone(input.customer_phone);
  if (!phone) throw new HttpError(400, 'INVALID_PHONE', 'Enter a valid 10-digit US phone number.');
  const hasEmail = input.customer_email !== undefined && input.customer_email !== null && input.customer_email !== '';
  const email = hasEmail ? normalizeEmail(input.customer_email) : null;
  if (hasEmail && !email) throw new HttpError(400, 'INVALID_EMAIL', 'Enter a valid email address or leave it blank.');
  return { ref: input.ref, customer_name: name, customer_phone: phone, customer_email: email };
}
