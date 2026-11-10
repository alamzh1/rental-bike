export type PhoneResult = { ok: true; e164: string } | { ok: false };

/**
 * Телефон в E.164. Принимает «+84 912…», «0084…», вьетнамский национальный «0912…».
 * Остальное без «+» — неоднозначно (код страны неизвестен), поэтому отклоняется.
 */
export function parsePhone(raw: string): PhoneResult {
  const trimmed = raw.trim();
  if (!/^[+\d][\d\s().-]*$/.test(trimmed)) return { ok: false };
  const digits = trimmed.replace(/\D/g, '');
  let e164: string;
  if (trimmed.startsWith('+')) e164 = `+${digits}`;
  else if (digits.startsWith('00')) e164 = `+${digits.slice(2)}`;
  else if (digits.startsWith('0') && digits.length === 10) e164 = `+84${digits.slice(1)}`;
  else return { ok: false };
  return /^\+[1-9]\d{7,14}$/.test(e164) ? { ok: true, e164 } : { ok: false };
}
