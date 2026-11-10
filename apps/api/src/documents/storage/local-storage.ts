import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { assertSafeKey, clampGetTtl, DEFAULT_PUT_TTL_SEC, type PresignedGet, type PresignedUpload, type Storage } from './storage';
import { filesSigningSecret, joinPublicUrl, localStorageDir, publicBaseUrl } from './config';

// Локальное хранилище (D01): storage/public — раздаёт API по /api/files/public/*;
// storage/private — только по подписанной ссылке (HMAC, срок ≤ 600 с на чтение), файлы зашифрованы AES-256-GCM (аналог SSE).

export type SignedOp = 'put' | 'get';

export interface SignedParams {
  key: string;
  exp: number;
  sig: string;
  /** Тип файла (подписан для put) */
  ct?: string;
}

const MAGIC = Buffer.from('RBENC1');

export class LocalStorage implements Storage {
  readonly kind = 'local' as const;

  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly now: () => Date = () => new Date(),
  ) {}

  get root(): string {
    return localStorageDir(this.env);
  }

  publicPath(key: string): string {
    return join(this.root, 'public', assertSafeKey(key));
  }

  privatePath(key: string): string {
    return join(this.root, 'private', assertSafeKey(key));
  }

  private apiBase(): string {
    return `${(this.env.API_PUBLIC_URL ?? '').replace(/\/$/, '')}/api/files/private`;
  }

  private sign(op: SignedOp, key: string, exp: number, ct = ''): string {
    return createHmac('sha256', filesSigningSecret(this.env)).update(`${op}\n${key}\n${exp}\n${ct}`).digest('base64url');
  }

  private url(op: SignedOp, key: string, ttlSec: number, ct?: string): { url: string; expiresAt: Date } {
    const exp = Math.floor(this.now().getTime() / 1000) + ttlSec;
    const q = new URLSearchParams({ key, exp: String(exp), sig: this.sign(op, key, exp, ct ?? '') });
    if (ct) q.set('ct', ct);
    return { url: `${this.apiBase()}?${q.toString()}`, expiresAt: new Date(exp * 1000) };
  }

  /** Проверка подписанной ссылки: подпись, срок и (для чтения) срок не дольше 600 с от текущего момента. */
  verify(op: SignedOp, p: SignedParams): boolean {
    if (!p.key || !p.sig || !Number.isInteger(p.exp)) return false;
    try {
      assertSafeKey(p.key);
    } catch {
      return false;
    }
    const nowSec = Math.floor(this.now().getTime() / 1000);
    if (p.exp < nowSec) return false;
    if (op === 'get' && p.exp - nowSec > clampGetTtl(undefined)) return false;
    const expected = Buffer.from(this.sign(op, p.key, p.exp, p.ct ?? ''));
    const given = Buffer.from(p.sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async presignPut(key: string, contentType: string, ttlSec = DEFAULT_PUT_TTL_SEC): Promise<PresignedUpload> {
    assertSafeKey(key);
    const { url, expiresAt } = this.url('put', key, ttlSec, contentType);
    return { url, method: 'PUT', headers: { 'Content-Type': contentType }, expiresAt };
  }

  async presignGet(key: string, ttlSec?: number): Promise<PresignedGet> {
    assertSafeKey(key);
    return this.url('get', key, clampGetTtl(ttlSec));
  }

  private cipherKey(): Buffer {
    return createHash('sha256').update(`storage-at-rest\n${filesSigningSecret(this.env)}`).digest();
  }

  /** Запись приватного файла (шифрование на стороне сервера). */
  async writePrivate(key: string, body: Buffer, contentType: string): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.cipherKey(), iv);
    const ct = Buffer.from(contentType);
    const enc = Buffer.concat([cipher.update(body), cipher.final()]);
    const header = Buffer.alloc(2);
    header.writeUInt16BE(ct.length);
    const path = this.privatePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.concat([MAGIC, iv, cipher.getAuthTag(), header, ct, enc]));
  }

  /** Чтение приватного файла; null — нет файла. */
  async readPrivate(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    let raw: Buffer;
    try {
      raw = await readFile(this.privatePath(key));
    } catch {
      return null;
    }
    if (!raw.subarray(0, MAGIC.length).equals(MAGIC)) return null;
    let o = MAGIC.length;
    const iv = raw.subarray(o, (o += 12));
    const tag = raw.subarray(o, (o += 16));
    const ctLen = raw.readUInt16BE(o);
    o += 2;
    const contentType = raw.subarray(o, (o += ctLen)).toString();
    const decipher = createDecipheriv('aes-256-gcm', this.cipherKey(), iv);
    decipher.setAuthTag(tag);
    return { body: Buffer.concat([decipher.update(raw.subarray(o)), decipher.final()]), contentType };
  }

  async exists(key: string): Promise<boolean> {
    return access(this.privatePath(key)).then(
      () => true,
      () => false,
    );
  }

  async delete(key: string): Promise<void> {
    await rm(this.privatePath(key), { force: true });
  }

  publicUrl(key: string): string {
    return joinPublicUrl(publicBaseUrl(this.env), key);
  }
}
