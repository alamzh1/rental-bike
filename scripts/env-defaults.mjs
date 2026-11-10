// Локальные значения по умолчанию для dev — совпадают с docker-compose.yml. Не секреты:
// это адреса и учётки локальных контейнеров. В prod все переменные задаются явно.
export const devDefaults = {
  NODE_ENV: 'development',
  DEV_AUTH: '1',
  API_PORT: '3000',
  MINIAPP_URL: 'http://localhost:5173',
  ADMIN_URL: 'http://localhost:5174',
  API_PUBLIC_URL: 'http://localhost:3000',
  POSTGRES_USER: 'rental',
  POSTGRES_PASSWORD: 'rental',
  POSTGRES_DB: 'rental',
  POSTGRES_PORT: '5442',
  REDIS_PORT: '6389',
  MINIO_PORT: '9010',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  S3_BUCKET_PUBLIC: 'rental-public',
  S3_BUCKET_PRIVATE: 'rental-private',
  JWT_SECRET: 'dev-only-jwt-secret',
  ADMIN_SESSION_SECRET: 'dev-only-admin-secret',
  FILES_SIGNING_SECRET: 'dev-only-files-secret',
  PAYMENT_KEYS_SECRET: 'dev-only-payment-keys-secret',
};

/** Загружает .env из корня (если есть) и подставляет dev-значения для пустых переменных. */
export function applyEnv() {
  try {
    process.loadEnvFile(new URL('../.env', import.meta.url));
  } catch {
    // .env может отсутствовать — это нормально для dev
  }
  if (process.env.NODE_ENV === 'production') return;
  for (const [key, value] of Object.entries(devDefaults)) {
    if (!process.env[key]) process.env[key] = value;
  }
  const e = process.env;
  const pg = `postgresql://${e.POSTGRES_USER}:${e.POSTGRES_PASSWORD}@localhost:${e.POSTGRES_PORT}`;
  e.DATABASE_URL ||= `${pg}/${e.POSTGRES_DB}?schema=public`;
  e.DATABASE_URL_TEST ||= `${pg}/${e.POSTGRES_DB}_test?schema=public`;
  e.REDIS_URL ||= `redis://localhost:${e.REDIS_PORT}`;
  // MinIO — по желанию (D01): адрес подставляется, только если задан MINIO_IMAGE; иначе API хранит файлы в storage/ (LocalStorage)
  if (e.MINIO_IMAGE) e.S3_ENDPOINT ||= `http://localhost:${e.MINIO_PORT}`;
  if (e.S3_ENDPOINT) e.S3_PUBLIC_URL ||= `${e.S3_ENDPOINT}/${e.S3_BUCKET_PUBLIC}`;
}
