import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import type { AuditList } from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles, RolesGuard } from '../../auth/roles';
import { badRequest } from '../../auth/api-errors';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AdminSessionGuard, displayName, type AdminUser } from '../auth';

const PAGE_SIZE = 50;

/** Журнал действий (AuditLog): только администратор. */
@ApiTags('admin')
@Controller('admin/audit')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AdminUser, @Query() q: Record<string, unknown>): Promise<AuditList> {
    const page = q.page === undefined ? 1 : Number(q.page);
    if (!Number.isInteger(page) || page < 1) throw badRequest('page must be a positive integer');
    const str = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 100) : undefined);
    // Выбрана точка: только действия её владельца и менеджеров
    const point = user.locationId ?? str(q.locationId);
    const where: Prisma.AuditLogWhereInput = { entity: str(q.entity), entityId: str(q.entityId), actorId: str(q.actorId), ...(point ? { actor: { locationId: point } } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, firstName: true, lastName: true, username: true, telegramId: true, role: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        at: r.createdAt.toISOString(),
        actor: r.actor ? { id: r.actor.id, name: displayName(r.actor), role: r.actor.role } : null,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        diff: (r.diff as Record<string, unknown> | null) ?? null,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }
}
