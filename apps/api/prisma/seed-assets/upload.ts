/**
 * Загрузка демо-фото моделей (seed-assets/photos, собирает scripts/photos/convert.mjs).
 * Заданы S3_ENDPOINT и ключи — кладём в публичный бакет S3/MinIO; иначе (dev, D01) копируем в storage/public/
 * (его отдаёт API по /files/public/*). Возвращает значение BikeModel.photos.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const photosDir = join(__dirname, 'photos');
const localPublicDir = join(__dirname, '../../../../storage/public');

interface ManifestEntry {
  view: string;
  sizes: Record<string, { webp: string; avif: string }>;
}
interface Manifest {
  models: Record<string, ManifestEntry[]>;
}
export type SeedPhoto = {
  key: string;
  alt: { ru: string; en: string; vi: string };
  demo: true;
  sizes: Record<string, { webp: string; avif: string }>;
};

const CONTENT_TYPES: Record<string, string> = { webp: 'image/webp', avif: 'image/avif' };

let s3Down = false;

function createS3() {
  if (s3Down) return null;
  const { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_PUBLIC, S3_REGION } = process.env;
  if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET_PUBLIC) return null;
  const client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION || 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  });
  return { client, bucket: S3_BUCKET_PUBLIC };
}

export async function uploadModelPhotos(slug: string, modelName: string): Promise<SeedPhoto[]> {
  const manifestPath = join(photosDir, 'manifest.json');
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  const entries = manifest.models[slug] ?? [];
  let s3 = createS3();
  const photos: SeedPhoto[] = [];

  for (const entry of entries) {
    const sizes: SeedPhoto['sizes'] = {};
    for (const [width, files] of Object.entries(entry.sizes)) {
      const keys: Record<'webp' | 'avif', string> = { webp: '', avif: '' };
      for (const ext of ['webp', 'avif'] as const) {
        const key = `models/${files[ext]}`;
        const source = join(photosDir, files[ext]);
        if (s3) {
          try {
            await s3.client.send(
              new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: readFileSync(source), ContentType: CONTENT_TYPES[ext], CacheControl: 'public, max-age=31536000, immutable' }),
            );
            keys[ext] = key;
            continue;
          } catch (e) {
            // MinIO в dev может быть не запущен (D01) — тогда кладём файлы в локальное хранилище
            if ((e as { name?: string }).name !== 'AggregateError' && (e as { code?: string }).code !== 'ECONNREFUSED') throw e;
            console.warn('seed: S3 недоступен, фото копируются в storage/public');
            s3Down = true;
            s3 = null;
          }
        }
        const target = join(localPublicDir, key);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(source, target);
        keys[ext] = key;
      }
      sizes[width] = keys;
    }
    photos.push({
      key: `models/${slug}/${entry.view}`,
      alt: { ru: `${modelName} — демо-фото`, en: `${modelName} — demo photo`, vi: `${modelName} — ảnh minh họa` },
      demo: true,
      sizes,
    });
  }
  return photos;
}
