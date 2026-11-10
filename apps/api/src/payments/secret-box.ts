import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Ключи оплаты точек хранятся в БД зашифрованными (AES-256-GCM). Ключ шифрования — PAYMENT_KEYS_SECRET.

function key(env: NodeJS.ProcessEnv): Buffer {
  const secret = env.PAYMENT_KEYS_SECRET;
  if (!secret) throw new Error('PAYMENT_KEYS_SECRET is not set');
  return createHash('sha256').update(secret).digest();
}

export function paymentKeysConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!env.PAYMENT_KEYS_SECRET;
}

export function sealSecret(plain: string, env: NodeJS.ProcessEnv = process.env): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(env), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function openSecret(sealed: string, env: NodeJS.ProcessEnv = process.env): string {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || data === undefined) throw new Error('Unknown secret format');
  const decipher = createDecipheriv('aes-256-gcm', key(env), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
