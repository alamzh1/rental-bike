import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AdminDocumentList, DocumentDto, DocumentUrlResponse } from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest } from '../../auth/api-errors';
import { DocumentsService, toDocumentDto } from '../../documents/documents.service';
import { STORAGE, type Storage } from '../../documents/storage/storage';
import { NOTIFIER, renderBotText, type Notifier } from '../../notifications/notifier';
import { displayName, type AdminUser } from '../auth';
import { actorOf, asBody, oneOf, optStr, pageOf } from '../fleet/input';

const PAGE_SIZE = 30;
const STATUSES = ['UPLOADED', 'VERIFIED', 'REJECTED'] as const;

@Injectable()
export class AdminDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    @Inject(STORAGE) private readonly storage: Storage,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) {}

  /** Очередь проверки: по умолчанию ждущие решения, старые первыми. */
  async list(q: Record<string, unknown>): Promise<AdminDocumentList> {
    const status = q.status ? oneOf(q.status, 'status', STATUSES) : 'UPLOADED';
    const page = pageOf(q.page);
    const where: Prisma.DocumentWhereInput = { deletedAt: null, status };
    const rows = await this.prisma.document.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, username: true, telegramId: true, phone: true, licenseCategory: true } }, verifiedBy: { select: { firstName: true, lastName: true, username: true, telegramId: true } } },
      orderBy: { createdAt: status === 'UPLOADED' ? 'asc' : 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    });
    const [total, waiting] = await Promise.all([this.prisma.document.count({ where }), this.prisma.document.count({ where: { deletedAt: null, status: 'UPLOADED' } })]);
    // Запись без файла — брошенная загрузка: проверять нечего
    const stored = await Promise.all(rows.map(async (d) => ((await this.storage.exists(d.fileKey)) ? d : null)));
    return {
      items: stored.filter((d) => d !== null).map((d) => ({ ...toDocumentDto(d), clientName: displayName(d.user), clientPhone: d.user.phone, clientLicense: d.user.licenseCategory, rejectReason: d.rejectReason, verifiedBy: d.verifiedBy ? displayName(d.verifiedBy) : null })),
      total,
      waiting,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  url(user: AdminUser, id: string): Promise<DocumentUrlResponse> {
    return this.documents.signedUrl(actorOf(user), id);
  }

  async verify(user: AdminUser, id: string, body: unknown): Promise<DocumentDto> {
    const b = asBody(body);
    if (b.status !== 'VERIFIED' && b.status !== 'REJECTED') throw badRequest('status must be VERIFIED or REJECTED');
    const reason = optStr(b.rejectReason, 'rejectReason', 300);
    const doc = await this.documents.verify(actorOf(user), id, b.status, reason);
    if (b.status === 'REJECTED') {
      const row = await this.prisma.document.findUnique({ where: { id }, select: { user: { select: { telegramId: true, lang: true } } } });
      if (row) {
        const lang = row.user.lang;
        const type = renderBotText(`bot.documentType.${doc.type}`, { lang });
        await this.notifier.send(row.user.telegramId, reason ? 'bot.client.documentRejectedReason' : 'bot.client.documentRejected', { lang, type, reason: reason ?? '' }, { textKey: 'bot.hint.button', startapp: 'documents' }).catch(() => undefined);
      }
    }
    return doc;
  }
}
