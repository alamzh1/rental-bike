import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Document } from '@prisma/client';
import {
  DOCUMENT_CONTENT_TYPES,
  type CreateDocumentRequest,
  type CreateDocumentResponse,
  type DocumentDto,
  type DocumentListResponse,
  type DocumentType,
  type DocumentUrlResponse,
  MAX_DOCUMENTS_PER_USER,
} from '@rental/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';
import { Clock } from '../jobs/clock';
import { notFound } from '../auth/api-errors';
import { loadStaffScope, scopeWhere } from '../auth/staff-scope';
import { apiError } from '../bookings/errors';
import { writeAudit, type Actor } from '../bookings/audit';
import { loadBookingRules } from '../bookings/rules';
import { MAX_GET_TTL_SEC, STORAGE, type Storage } from './storage/storage';

// Документы клиента: загрузка по подписанной ссылке в приватное хранилище, согласие на обработку ПД при первой загрузке,
// ссылки на чтение ≤ 10 мин — только менеджеру точки и администратору, очистка через docRetentionDays.

const TYPES: DocumentType[] = ['PASSPORT', 'LICENSE', 'IDP'];
const LICENSES = ['A1', 'A', 'NONE'] as const;
export const JOB_DOCUMENTS_CLEANUP = 'documents.cleanup';
/** Ссылка на загрузку живёт 10 минут: позже файл уже не придёт. */
const UNFINISHED_AFTER_MS = 15 * 60_000;
const DAY_MS = 86_400_000;

export function toDocumentDto(d: Document): DocumentDto {
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    contentType: d.contentType,
    licenseCategory: d.licenseCategory,
    verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  };
}

@Injectable()
export class DocumentsService implements OnModuleInit {
  private readonly log = new Logger('Documents');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly clock: Clock,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  onModuleInit(): void {
    this.jobs.every(JOB_DOCUMENTS_CLEANUP, DAY_MS, async () => void (await this.cleanup()));
  }

  /** POST /documents → подписанная ссылка на загрузку. Без согласия на обработку ПД при первой загрузке → 400 CONSENT_REQUIRED. */
  async create(userId: string, req: Partial<CreateDocumentRequest>): Promise<CreateDocumentResponse> {
    if (!TYPES.includes(req.type as DocumentType)) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'type must be PASSPORT, LICENSE or IDP');
    if (!DOCUMENT_CONTENT_TYPES.includes(req.contentType as (typeof DOCUMENT_CONTENT_TYPES)[number])) {
      throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', `contentType must be one of ${DOCUMENT_CONTENT_TYPES.join(', ')}`);
    }
    if (req.licenseCategory !== undefined && !LICENSES.includes(req.licenseCategory)) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'licenseCategory must be A1, A or NONE');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { pdConsentAt: true } });
    if (!user) throw notFound('User not found');
    const now = this.clock.now();
    if (!user.pdConsentAt) {
      if (req.consent !== true) throw apiError(HttpStatus.BAD_REQUEST, 'CONSENT_REQUIRED', 'Consent to personal data processing is required');
      await this.prisma.user.update({ where: { id: userId }, data: { pdConsentAt: now } });
    }
    await this.assertRoom(userId);
    await this.prisma.user.updateMany({ where: { id: userId, verificationStatus: { not: 'VERIFIED' } }, data: { verificationStatus: 'PENDING' } });
    const key = `documents/${userId}/${req.type!.toLowerCase()}-${now.getTime()}-${randomBytes(6).toString('hex')}`;
    const doc = await this.prisma.document.create({
      data: { userId, type: req.type!, fileKey: key, contentType: req.contentType!, licenseCategory: req.licenseCategory ?? null },
    });
    const upload = await this.storage.presignPut(key, req.contentType!);
    return { documentId: doc.id, uploadUrl: upload.url, method: 'PUT', headers: upload.headers, expiresAt: upload.expiresAt.toISOString() };
  }

  /** Диск общий с базой и копиями: один клиент не должен заполнить его документами. Брошенные загрузки место не занимают. */
  private async assertRoom(userId: string): Promise<void> {
    const where = { userId, deletedAt: null };
    if ((await this.prisma.document.count({ where })) < MAX_DOCUMENTS_PER_USER) return;
    await this.purgeUnfinished({ userId });
    if ((await this.prisma.document.count({ where })) >= MAX_DOCUMENTS_PER_USER) throw apiError(HttpStatus.CONFLICT, 'DOCUMENT_LIMIT', `At most ${MAX_DOCUMENTS_PER_USER} documents`);
  }

  /** Запись создана, а файл так и не загружен, и ссылка на загрузку уже истекла. */
  private async purgeUnfinished(scope: { userId?: string } = {}): Promise<number> {
    const rows = await this.prisma.document.findMany({
      where: { ...scope, deletedAt: null, status: 'UPLOADED', createdAt: { lte: new Date(this.clock.now().getTime() - UNFINISHED_AFTER_MS) } },
      select: { id: true, fileKey: true },
      take: 500,
    });
    let removed = 0;
    for (const d of rows) {
      if (await this.storage.exists(d.fileKey)) continue;
      await this.prisma.document.delete({ where: { id: d.id } });
      removed++;
    }
    return removed;
  }

  async list(userId: string): Promise<DocumentListResponse> {
    const [rows, user] = await Promise.all([
      this.prisma.document.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { pdConsentAt: true } }),
    ]);
    // Брошенная загрузка не должна выглядеть как готовый документ: при брони её не примут
    const stored = await Promise.all(rows.map(async (d) => ((await this.storage.exists(d.fileKey)) ? d : null)));
    return { items: stored.filter((d) => d !== null).map(toDocumentDto), consentGiven: !!user?.pdConsentAt };
  }

  /** Документ владельца; чужой → 404. */
  async getOwn(userId: string, id: string): Promise<Document> {
    const d = await this.prisma.document.findFirst({ where: { id, userId, deletedAt: null } });
    if (!d) throw notFound('Document not found');
    return d;
  }

  async removeOwn(userId: string, id: string): Promise<void> {
    const d = await this.getOwn(userId, id);
    await this.storage.delete(d.fileKey).catch((e: unknown) => this.log.warn(`delete ${d.id}: ${(e as Error).message}`));
    await this.prisma.document.update({ where: { id: d.id }, data: { deletedAt: this.clock.now() } });
  }

  /** Есть ли у сотрудника доступ: администратор — всегда; менеджер точки — если клиент бронировал в его точке; менеджер без точки — нет. */
  private async staffCanRead(actor: Actor, ownerId: string): Promise<boolean> {
    const scope = await loadStaffScope(this.prisma, actor);
    if (scope.kind === 'all') return true;
    if (scope.kind === 'none') return false;
    return (await this.prisma.booking.count({ where: { userId: ownerId, ...scopeWhere(scope) } })) > 0;
  }

  /** Ссылка на чтение для менеджера/администратора, живёт ≤ 600 с; выдача пишется в журнал. */
  async signedUrl(actor: Actor, id: string, ttlSec = MAX_GET_TTL_SEC): Promise<DocumentUrlResponse> {
    const d = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!d || !(await this.staffCanRead(actor, d.userId))) throw notFound('Document not found');
    const { url, expiresAt } = await this.storage.presignGet(d.fileKey, Math.min(ttlSec, MAX_GET_TTL_SEC));
    await writeAudit(this.prisma, actor, 'document.read', 'Document', d.id, { userId: d.userId });
    return { url, expiresAt: expiresAt.toISOString() };
  }

  /** Решение администратора «Проверено» / «Отклонено»: права на него — в AdminDocumentsController. */
  async verify(actor: Actor, id: string, status: 'VERIFIED' | 'REJECTED', rejectReason: string | null = null): Promise<DocumentDto> {
    const d = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!d || !(await this.staffCanRead(actor, d.userId))) throw notFound('Document not found');
    const now = this.clock.now();
    const updated = await this.prisma.document.update({
      where: { id },
      data: { status, verifiedById: actor.id, verifiedAt: now, rejectReason: status === 'REJECTED' ? rejectReason : null },
    });
    await this.prisma.user.update({ where: { id: d.userId }, data: { verificationStatus: status } });
    await writeAudit(this.prisma, actor, 'document.verify', 'Document', id, { status, rejectReason });
    return toDocumentDto(updated);
  }

  /**
   * Ежедневная очистка: документы удаляются через docRetentionDays после последней брони клиента,
   * если нет активной брони или спора («Проблема»); у клиентов без броней — через тот же срок после загрузки.
   */
  async cleanup(): Promise<number> {
    await this.purgeUnfinished();
    const { docRetentionDays } = await loadBookingRules(this.prisma);
    const cutoff = new Date(this.clock.now().getTime() - docRetentionDays * DAY_MS);
    const owners = await this.prisma.document.findMany({ where: { deletedAt: null, createdAt: { lte: cutoff } }, select: { userId: true }, distinct: ['userId'], take: 1000 });
    let removed = 0;
    for (const { userId } of owners) {
      const blocking = await this.prisma.booking.count({
        where: {
          userId,
          OR: [
            { status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'ISSUED', 'PROBLEM'] } },
            { endAt: { gt: cutoff } },
            { actualEndAt: { gt: cutoff } },
            { cancelledAt: { gt: cutoff } },
          ],
        },
      });
      if (blocking > 0) continue;
      const docs = await this.prisma.document.findMany({ where: { userId, deletedAt: null, createdAt: { lte: cutoff } } });
      for (const d of docs) {
        try {
          await this.storage.delete(d.fileKey);
          await this.prisma.document.update({ where: { id: d.id }, data: { deletedAt: this.clock.now() } });
          removed++;
        } catch (e) {
          this.log.warn(`cleanup ${d.id}: ${(e as Error).message}`);
        }
      }
    }
    if (removed) this.log.log(`Удалено документов: ${removed}`);
    return removed;
  }
}
