import type { I18nText, ModelPhoto, PhotoSize } from '@rental/shared';
import { joinPublicUrl, publicBaseUrl } from '../documents/storage/config';

// Публичные файлы (фото моделей, логотипы, баннер) хранятся ключами; клиенту отдаётся URL —
// тот же, что Storage.publicUrl(key): S3 — S3_PUBLIC_URL, локальное хранилище — <API_PUBLIC_URL>/api/files/public/<key> (D01).
export function publicFileUrl(key: string): string {
  if (/^(https?:)?\/\//.test(key) || key.startsWith('/') || key.startsWith('data:')) return key;
  return joinPublicUrl(publicBaseUrl(), key);
}

const PREFERRED_WIDTH = '800';

/** Фото из BikeModel.photos: [{ key, alt?, sizes: { 400: { webp, avif } } }]. Битые записи пропускаются. */
export function toPhotos(raw: unknown): ModelPhoto[] {
  if (!Array.isArray(raw)) return [];
  const out: ModelPhoto[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const rec = p as { key?: unknown; alt?: unknown; sizes?: unknown };
    const sizes: Record<string, PhotoSize> = {};
    if (rec.sizes && typeof rec.sizes === 'object') {
      for (const [w, s] of Object.entries(rec.sizes as Record<string, unknown>)) {
        const v = s as { webp?: unknown; avif?: unknown } | null;
        if (v && typeof v.webp === 'string') sizes[w] = { webp: publicFileUrl(v.webp), ...(typeof v.avif === 'string' ? { avif: publicFileUrl(v.avif) } : {}) };
      }
    }
    const widths = Object.keys(sizes).sort((a, b) => Number(a) - Number(b));
    const main = sizes[PREFERRED_WIDTH]?.webp ?? (widths.length ? sizes[widths[widths.length - 1]!]!.webp : typeof rec.key === 'string' ? publicFileUrl(rec.key) : null);
    if (!main) continue;
    out.push({ url: main, alt: rec.alt && typeof rec.alt === 'object' ? (rec.alt as I18nText) : null, sizes });
  }
  return out;
}
