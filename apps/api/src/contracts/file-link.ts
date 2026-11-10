import { createHmac, timingSafeEqual } from 'node:crypto';
import { filesSigningSecret } from '../documents/storage/config';

// Ссылка на файл брони без сессии: подпись HMAC и короткий срок, как у ссылок на документы.

export type BookingFile = 'contract' | 'calendar';
const TTL_MS = 5 * 60_000;

function sign(id: string, file: string, lang: string, exp: number): string {
  return createHmac('sha256', filesSigningSecret()).update(`${id}|${file}|${lang}|${exp}`).digest('hex');
}

export function signedFileUrl(id: string, file: BookingFile, lang: string, now: number): string {
  const exp = now + TTL_MS;
  const base = (process.env.API_PUBLIC_URL ?? '').replace(/\/$/, '');
  return `${base}/api/booking-files/${encodeURIComponent(id)}/${file}?lang=${lang}&exp=${exp}&sig=${sign(id, file, lang, exp)}`;
}

export function validFileSignature(id: string, file: string, lang: string, exp: number, sig: string, now: number): boolean {
  if (!Number.isFinite(exp) || exp < now) return false;
  const expected = Buffer.from(sign(id, file, lang, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
