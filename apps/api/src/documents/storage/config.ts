import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Выбор хранилища (D01): STORAGE_DRIVER=local|s3; без него — S3, если заданы S3_ENDPOINT, S3_ACCESS_KEY и S3_SECRET_KEY, иначе локальная папка.

export type StorageDriver = 'local' | 's3';

export function storageDriver(env: NodeJS.ProcessEnv = process.env): StorageDriver {
  const pref = env.STORAGE_DRIVER;
  if (pref === 'local' || pref === 's3') return pref;
  return env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY ? 's3' : 'local';
}

/** База URL публичных файлов: S3_PUBLIC_URL (или endpoint/бакет) для S3; для локального — <API_PUBLIC_URL>/api/files/public. */
export function publicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const base =
    storageDriver(env) === 's3'
      ? env.S3_PUBLIC_URL || `${(env.S3_ENDPOINT ?? '').replace(/\/$/, '')}/${env.S3_BUCKET_PUBLIC ?? ''}`
      : `${env.API_PUBLIC_URL ?? ''}/api/files/public`;
  return base.replace(/\/$/, '');
}

export function joinPublicUrl(base: string, key: string): string {
  return `${base}/${key.replace(/^\//, '')}`;
}

/** Корень монорепозитория (папка с pnpm-workspace.yaml). */
function repoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return process.cwd();
}

/** Папка локального хранилища: STORAGE_DIR или storage/ в корне репозитория (в .gitignore). */
export function localStorageDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.STORAGE_DIR ? resolve(env.STORAGE_DIR) : join(repoRoot(), 'storage');
}

/** Секрет подписи локальных ссылок: FILES_SIGNING_SECRET (в dev — значение по умолчанию из env-defaults). */
export function filesSigningSecret(env: NodeJS.ProcessEnv = process.env): string {
  const s = env.FILES_SIGNING_SECRET || env.JWT_SECRET;
  if (!s) throw new Error('FILES_SIGNING_SECRET is not set');
  return s;
}
