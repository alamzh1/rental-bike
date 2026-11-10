import { describe, expect, it } from 'vitest';
import { LocalStorage } from '../src/documents/storage/local-storage';
import { storageDriver, publicBaseUrl } from '../src/documents/storage/config';
import { publicFileUrl } from '../src/catalog/public-url';

// Storage (D01): выбор реализации по S3_*, ссылки на чтение приватных файлов ≤ 600 с, публичные URL.
const env = { API_PUBLIC_URL: 'http://api.test', FILES_SIGNING_SECRET: 'test-signing-secret' };

function params(url: string) {
  const q = new URL(url).searchParams;
  return { key: q.get('key')!, exp: Number(q.get('exp')), sig: q.get('sig')!, ct: q.get('ct') ?? undefined };
}

describe('LocalStorage', () => {
  it('ссылка на чтение живёт не дольше 600 с, даже если просили час', async () => {
    const now = new Date('2026-11-01T10:00:00Z');
    const s = new LocalStorage(env, () => now);
    const { url, expiresAt } = await s.presignGet('documents/u1/passport-1', 3600);
    expect(expiresAt.getTime() - now.getTime()).toBe(600_000);
    expect(s.verify('get', params(url))).toBe(true);
  });

  it('просроченная или подделанная ссылка не принимается; ссылка на загрузку не годится для чтения', async () => {
    let now = new Date('2026-11-01T10:00:00Z');
    const s = new LocalStorage(env, () => now);
    const get = params((await s.presignGet('documents/u1/a', 60)).url);
    expect(s.verify('get', { ...get, sig: get.sig.replace(/^./, get.sig[0] === 'A' ? 'B' : 'A') })).toBe(false);
    expect(s.verify('get', { ...get, key: 'documents/u2/a' })).toBe(false);
    const put = params((await s.presignPut('documents/u1/b', 'image/png')).url);
    expect(s.verify('get', put)).toBe(false);
    now = new Date('2026-11-01T10:01:01Z');
    expect(s.verify('get', get)).toBe(false);
  });

  it('ключ с выходом из папки отклоняется', async () => {
    const s = new LocalStorage(env);
    await expect(s.presignGet('../etc/passwd')).rejects.toThrow();
    expect(() => s.publicPath('models/../../x')).toThrow();
  });
});

describe('выбор хранилища и публичные URL', () => {
  it('S3 — только при S3_ENDPOINT и ключах; иначе локальное', () => {
    expect(storageDriver({})).toBe('local');
    expect(storageDriver({ S3_ENDPOINT: 'http://minio:9000' })).toBe('local');
    expect(storageDriver({ S3_ENDPOINT: 'http://minio:9000', S3_ACCESS_KEY: 'a', S3_SECRET_KEY: 'b' })).toBe('s3');
    expect(storageDriver({ STORAGE_DRIVER: 'local', S3_ENDPOINT: 'x', S3_ACCESS_KEY: 'a', S3_SECRET_KEY: 'b' })).toBe('local');
  });

  it('локальное: <API_PUBLIC_URL>/api/files/public/<key>; S3: S3_PUBLIC_URL', () => {
    expect(new LocalStorage(env).publicUrl('models/air/front34-800.webp')).toBe('http://api.test/api/files/public/models/air/front34-800.webp');
    expect(publicBaseUrl({ S3_ENDPOINT: 'http://minio:9000', S3_ACCESS_KEY: 'a', S3_SECRET_KEY: 'b', S3_PUBLIC_URL: 'https://cdn.test/pub/' })).toBe('https://cdn.test/pub');
  });

  it('каталог строит URL фото так же, как Storage.publicUrl', () => {
    const backup = { ...process.env };
    try {
      for (const k of ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'STORAGE_DRIVER', 'S3_PUBLIC_URL']) delete process.env[k];
      process.env.API_PUBLIC_URL = 'http://api.test';
      expect(publicFileUrl('models/air/1-800.webp')).toBe(new LocalStorage(env).publicUrl('models/air/1-800.webp'));
    } finally {
      process.env = backup;
    }
  });
});
