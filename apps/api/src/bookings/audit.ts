import type { Prisma } from '@prisma/client';
import type { Role } from '@rental/shared';

// Журнал действий менеджеров и администраторов (история 53) — таблица AuditLog.
export interface Actor {
  /** null — система (очередь, webhook) */
  id: string | null;
  role: Role | 'SYSTEM';
}

export const SYSTEM: Actor = { id: null, role: 'SYSTEM' };

export const isStaff = (a: Actor): boolean => a.role === 'MANAGER' || a.role === 'OWNER' || a.role === 'ADMIN';

type Db = { auditLog: Pick<Prisma.TransactionClient['auditLog'], 'create'> };

export async function writeAudit(db: Db, actor: Actor, action: string, entity: string, entityId: string | null, diff?: Record<string, unknown>): Promise<void> {
  await db.auditLog.create({ data: { actorId: actor.id, action, entity, entityId, diff: (diff ?? undefined) as Prisma.InputJsonValue | undefined } });
}
