import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { Controller, Get, HttpCode, HttpStatus, Inject, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DOCUMENT_MAX_BYTES } from '@rental/shared';
import { forbidden, notFound } from '../auth/api-errors';
import { apiError } from '../bookings/errors';
import { LocalStorage } from './storage/local-storage';
import { STORAGE, type Storage } from './storage/storage';

// Раздача файлов локальным хранилищем (D01): публичные — /api/files/public/<key>;
// приватные — только по подписанной ссылке /api/files/private?key&exp&sig (PUT — загрузка, GET — чтение ≤ 600 с).

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
};

function readBody(req: Request, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(apiError(HttpStatus.PAYLOAD_TOO_LARGE, 'FILE_TOO_LARGE', `File is larger than ${limit} bytes`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

type SignedQuery = { key?: string; exp?: string; sig?: string; ct?: string };

@Controller('files')
export class FilesController {
  private readonly local: LocalStorage;

  constructor(@Inject(STORAGE) storage: Storage) {
    this.local = storage instanceof LocalStorage ? storage : new LocalStorage();
  }

  @Get('public/*')
  async publicFile(@Req() req: Request, @Res() res: Response): Promise<void> {
    // Express уже декодировал параметр; повторный разбор падал на знаке %
    const key = (req.params as Record<string, string>)[0] ?? '';
    let path: string;
    try {
      path = this.local.publicPath(key);
    } catch {
      throw notFound();
    }
    const s = await stat(path).catch(() => null);
    if (!s?.isFile()) throw notFound();
    res.setHeader('Content-Type', MIME[extname(path).toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('Content-Length', String(s.size));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    createReadStream(path).pipe(res);
  }

  private params(q: SignedQuery) {
    return { key: q.key ?? '', exp: Number(q.exp), sig: q.sig ?? '', ct: q.ct };
  }

  @Put('private')
  @HttpCode(200)
  async upload(@Query() q: SignedQuery, @Req() req: Request): Promise<{ ok: true }> {
    const p = this.params(q);
    if (!this.local.verify('put', p)) throw forbidden('Invalid or expired upload link');
    const type = (req.headers['content-type'] ?? '').split(';')[0]!.trim();
    if (p.ct && type !== p.ct) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Content-Type does not match the upload link');
    const body = await readBody(req, DOCUMENT_MAX_BYTES);
    if (body.length === 0) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Empty file');
    await this.local.writePrivate(p.key, body, p.ct ?? type);
    return { ok: true };
  }

  @Get('private')
  async read(@Query() q: SignedQuery, @Res() res: Response): Promise<void> {
    const p = this.params(q);
    if (!this.local.verify('get', p)) throw forbidden('Invalid or expired link');
    const file = await this.local.readPrivate(p.key);
    if (!file) throw notFound();
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.body);
  }
}
