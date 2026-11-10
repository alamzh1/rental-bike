import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { HttpStatus } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { ADMIN_IMAGE_MAX_BYTES, MODEL_PHOTO_WIDTHS } from '@rental/shared';
import { apiError } from '../../bookings/errors';
import { assertSafeKey, localStorageDir, storageDriver } from '../../documents/storage';

// Публичные изображения из админки (фото моделей, логотипы брендов, баннер): конвертация sharp → WebP/AVIF
// и запись в публичную часть хранилища (S3_BUCKET_PUBLIC или storage/public в dev, D01). URL строит publicFileUrl.

export interface RawUpload {
  body: Buffer;
  contentType: string;
}

const ACCEPTED = /^image\/(jpeg|png|webp|avif|heic|heif|gif|svg\+xml)$/;

export const imageInvalid = (message = 'File is not a supported image') => apiError(HttpStatus.BAD_REQUEST, 'IMAGE_INVALID', message);

/** Тело запроса как есть (Content-Type: image/*): express не разбирает его json-парсером. */
export function readImageBody(req: NodeJS.ReadableStream & { headers: Record<string, string | string[] | undefined> }): Promise<RawUpload> {
  const contentType = String(req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (!ACCEPTED.test(contentType)) return Promise.reject(imageInvalid(`Content-Type ${contentType || '(none)'} is not an image`));
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > ADMIN_IMAGE_MAX_BYTES) {
        reject(apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'FILE_TOO_LARGE', `Image is larger than ${ADMIN_IMAGE_MAX_BYTES} bytes`));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => (chunks.length ? resolve({ body: Buffer.concat(chunks), contentType }) : reject(imageInvalid('Empty file'))));
    req.on('error', reject);
  });
}

export interface ConvertedImage {
  /** ширина → { webp, avif } буферы */
  sizes: Record<string, { webp: Buffer; avif: Buffer }>;
}

/** Фото модели: 400/800/1200 px по ширине, WebP и AVIF каждой ширины. Битый файл → 400 IMAGE_INVALID. */
export async function convertPhoto(input: Buffer, widths: readonly number[] = MODEL_PHOTO_WIDTHS): Promise<ConvertedImage> {
  try {
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) throw new Error('no dimensions');
  } catch {
    throw imageInvalid();
  }
  const sizes: ConvertedImage['sizes'] = {};
  try {
  for (const w of widths) {
    const base = () => sharp(input).rotate().resize({ width: w, withoutEnlargement: false });
    const [webp, avif] = await Promise.all([base().webp({ quality: 80 }).toBuffer(), base().avif({ quality: 55, effort: 2 }).toBuffer()]);
    sizes[String(w)] = { webp, avif };
  }
  } catch {
    // Заголовок читается, а сам файл обрезан или повреждён
    throw imageInvalid();
  }
  return { sizes };
}

let s3: S3Client | null = null;
function s3Client(env: NodeJS.ProcessEnv): S3Client {
  s3 ??= new S3Client({
    endpoint: env.S3_ENDPOINT || undefined,
    region: env.S3_REGION || 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY ?? '', secretAccessKey: env.S3_SECRET_KEY ?? '' },
  });
  return s3;
}

/** Запись публичного файла по ключу. */
export async function writePublic(key: string, body: Buffer, contentType: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  assertSafeKey(key);
  if (storageDriver(env) === 's3') {
    await s3Client(env).send(new PutObjectCommand({ Bucket: env.S3_BUCKET_PUBLIC, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }));
    return;
  }
  const path = join(localStorageDir(env), 'public', key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

/** Удаление публичного файла (нет файла — не ошибка). Демо-фото сида не удаляются: на них могут ссылаться другие записи. */
export async function deletePublic(key: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  try {
    assertSafeKey(key);
  } catch {
    return;
  }
  if (storageDriver(env) === 's3') {
    await s3Client(env).send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET_PUBLIC, Key: key })).catch(() => undefined);
    return;
  }
  await rm(join(localStorageDir(env), 'public', key), { force: true });
}

/** Сохранить фото во всех размерах под префиксом `<prefix>`; вернуть запись для BikeModel.photos (ключи без URL). */
export async function storePhoto(prefix: string, img: ConvertedImage): Promise<Record<string, { webp: string; avif: string }>> {
  const out: Record<string, { webp: string; avif: string }> = {};
  for (const [w, s] of Object.entries(img.sizes)) {
    const webp = `${prefix}-${w}.webp`;
    const avif = `${prefix}-${w}.avif`;
    await writePublic(webp, s.webp, 'image/webp');
    await writePublic(avif, s.avif, 'image/avif');
    out[w] = { webp, avif };
  }
  return out;
}
