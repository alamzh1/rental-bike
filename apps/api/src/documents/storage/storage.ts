// Хранилище файлов: публичное (фото моделей, логотипы, баннер) и приватное (документы, фотоакты).
// Реализации: S3Storage (S3/MinIO, заданы S3_ENDPOINT и ключи) и LocalStorage (dev, папка storage/, D01).

/** Максимальный срок подписанной ссылки на чтение приватного файла, с (история 54). */
export const MAX_GET_TTL_SEC = 600;
export const DEFAULT_PUT_TTL_SEC = 600;

export interface PresignedUpload {
  url: string;
  method: 'PUT';
  /** Заголовки, которые клиент обязан отправить с PUT */
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface PresignedGet {
  url: string;
  expiresAt: Date;
}

export interface Storage {
  readonly kind: 'local' | 's3';
  /** Подписанная ссылка на загрузку в приватное хранилище (с шифрованием на стороне сервера). */
  presignPut(key: string, contentType: string, ttlSec?: number): Promise<PresignedUpload>;
  /** Подписанная ссылка на чтение приватного файла; ttlSec ≤ 600. */
  presignGet(key: string, ttlSec?: number): Promise<PresignedGet>;
  /** Файл загружен в приватное хранилище. */
  exists(key: string): Promise<boolean>;
  /** Удаление приватного файла (нет файла — не ошибка). */
  delete(key: string): Promise<void>;
  /** URL публичного файла по ключу. */
  publicUrl(key: string): string;
}

/** DI-токен: `@Inject(STORAGE) storage: Storage`. */
export const STORAGE = Symbol('STORAGE');

export function clampGetTtl(ttlSec: number | undefined): number {
  const t = Math.floor(ttlSec ?? MAX_GET_TTL_SEC);
  if (!Number.isFinite(t) || t <= 0) return MAX_GET_TTL_SEC;
  return Math.min(t, MAX_GET_TTL_SEC);
}

/** Ключ: латиница, цифры, `-_./`, без `..` и ведущего `/`. */
export function assertSafeKey(key: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,500}$/.test(key) || key.split('/').some((p) => p === '..' || p === '.' || p === '')) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
  return key;
}
