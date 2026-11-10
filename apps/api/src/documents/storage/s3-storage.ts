import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, type ServerSideEncryption } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { assertSafeKey, clampGetTtl, DEFAULT_PUT_TTL_SEC, type PresignedGet, type PresignedUpload, type Storage } from './storage';
import { joinPublicUrl, publicBaseUrl } from './config';

// S3/MinIO: публичный бакет S3_BUCKET_PUBLIC, приватный S3_BUCKET_PRIVATE.
// Шифрование загрузки — S3_SSE (по умолчанию AES256; `none` — выключить, если MinIO без KMS).

export class S3Storage implements Storage {
  readonly kind = 's3' as const;
  private readonly client: S3Client;
  private readonly privateBucket: string;
  private readonly sse: ServerSideEncryption | undefined;

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_PRIVATE } = env;
    if (!S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET_PRIVATE) throw new Error('S3 storage requires S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_PRIVATE');
    this.client = new S3Client({
      endpoint: S3_ENDPOINT || undefined,
      region: S3_REGION || 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
    });
    this.privateBucket = S3_BUCKET_PRIVATE;
    const sse = env.S3_SSE;
    this.sse = sse === 'none' ? undefined : ((sse || 'AES256') as ServerSideEncryption);
  }

  async presignPut(key: string, contentType: string, ttlSec = DEFAULT_PUT_TTL_SEC): Promise<PresignedUpload> {
    const cmd = new PutObjectCommand({ Bucket: this.privateBucket, Key: assertSafeKey(key), ContentType: contentType, ServerSideEncryption: this.sse });
    const url = await getSignedUrl(this.client, cmd, { expiresIn: ttlSec });
    return { url, method: 'PUT', headers: { 'Content-Type': contentType }, expiresAt: new Date(Date.now() + ttlSec * 1000) };
  }

  async presignGet(key: string, ttlSec?: number): Promise<PresignedGet> {
    const ttl = clampGetTtl(ttlSec);
    const url = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.privateBucket, Key: assertSafeKey(key) }), { expiresIn: ttl });
    return { url, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.privateBucket, Key: assertSafeKey(key) }));
      return true;
    } catch (e) {
      if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.privateBucket, Key: assertSafeKey(key) }));
  }

  publicUrl(key: string): string {
    return joinPublicUrl(publicBaseUrl(this.env), key);
  }
}
