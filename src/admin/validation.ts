import { HttpError } from '../http.ts';
import { normalizePhone } from '../validation.ts';

export interface PartnerCreate {
  name: string;
  phone: string;
  referralCode: string;
  rewardCents: number;
}

export interface PartnerUpdate {
  version: number;
  name?: string;
  phone?: string;
  rewardCents?: number;
  active?: boolean;
}

const record = (value: unknown): Record<string,unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400,'INVALID_INPUT','Enter valid partner details.');
  }
  return value as Record<string,unknown>;
};

const exactKeys = (input: Record<string,unknown>, allowed: string[]) => {
  if (Object.keys(input).some(key => !allowed.includes(key))) {
    throw new HttpError(400,'INVALID_INPUT','The form contains unsupported fields.');
  }
};

const name = (value: unknown): string => {
  const result = typeof value === 'string' ? value.trim().replace(/\s+/g,' ') : '';
  if (!result || result.length > 120 || /[\u0000-\u001f\u007f]/.test(result)) {
    throw new HttpError(400,'INVALID_PARTNER_NAME','Enter a partner name up to 120 characters.');
  }
  return result;
};

const phone = (value: unknown): string => {
  const result = normalizePhone(value);
  if (!result) throw new HttpError(400,'INVALID_PARTNER_PHONE','Enter a valid 10-digit US phone number.');
  return result;
};

const reward = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 100000000) {
    throw new HttpError(400,'INVALID_REWARD','Enter a fixed reward in whole cents within the staging database limit.');
  }
  return value as number;
};

export function validatePartnerCreate(value: unknown): PartnerCreate {
  const input=record(value);
  exactKeys(input,['name','phone','referral_code','reward_amount_cents']);
  const referralCode=typeof input.referral_code==='string' ? input.referral_code.trim().toLowerCase() : '';
  if (!/^[a-z0-9-]{1,64}$/.test(referralCode)) {
    throw new HttpError(400,'INVALID_REFERRAL_CODE','Use lowercase letters, numbers, and hyphens only.');
  }
  return {name:name(input.name),phone:phone(input.phone),referralCode,rewardCents:reward(input.reward_amount_cents)};
}

export function validatePartnerUpdate(value: unknown): PartnerUpdate {
  const input=record(value);
  exactKeys(input,['version','name','phone','reward_amount_cents','active']);
  if (!Number.isSafeInteger(input.version) || (input.version as number) < 1) {
    throw new HttpError(400,'INVALID_VERSION','Reload the partner before saving changes.');
  }
  const result: PartnerUpdate={version:input.version as number};
  if ('name' in input) result.name=name(input.name);
  if ('phone' in input) result.phone=phone(input.phone);
  if ('reward_amount_cents' in input) result.rewardCents=reward(input.reward_amount_cents);
  if ('active' in input) {
    if (typeof input.active !== 'boolean') throw new HttpError(400,'INVALID_ACTIVE','Choose an active or inactive state.');
    result.active=input.active;
  }
  if (Object.keys(result).length===1) throw new HttpError(400,'INVALID_INPUT','Change at least one partner field.');
  return result;
}
