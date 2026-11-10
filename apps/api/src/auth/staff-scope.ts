import type { Role } from '@rental/shared';
import type { PrismaService } from '../prisma/prisma.service';

// Область видимости сотрудника — единственное место правила (истории 54, 84):
// администратор — все точки или выбранная; менеджер и владелец — только своя точка; без точки и любая другая роль — ни одной.

export type StaffScope = { kind: 'all' } | { kind: 'location'; locationId: string } | { kind: 'none' };

/** Prisma-условие «ни одной точки»: `in: []` не совпадает ни с одной строкой. */
const NOTHING = { in: [] as string[] };

export function staffScope(staff: { role: Role | 'SYSTEM'; locationId: string | null | undefined }): StaffScope {
  if (staff.role === 'ADMIN') return staff.locationId ? { kind: 'location', locationId: staff.locationId } : { kind: 'all' };
  if ((staff.role === 'MANAGER' || staff.role === 'OWNER') && staff.locationId) return { kind: 'location', locationId: staff.locationId };
  return { kind: 'none' };
}

/** Область по актору без locationId (Mini App): точку менеджера читает из БД. */
export async function loadStaffScope(
  prisma: Pick<PrismaService, 'user'>,
  actor: { id: string | null; role: Role | 'SYSTEM' },
): Promise<StaffScope> {
  if (actor.role === 'ADMIN') return { kind: 'all' };
  if ((actor.role !== 'MANAGER' && actor.role !== 'OWNER') || !actor.id) return { kind: 'none' };
  const u = await prisma.user.findUnique({ where: { id: actor.id }, select: { locationId: true } });
  return staffScope({ role: actor.role, locationId: u?.locationId });
}

/**
 * Prisma-фрагмент `where` по полю locationId. Администратор может сузить выборку до `requested` точки;
 * менеджеру запрошенная точка не расширяет область.
 */
export function scopeWhere(scope: StaffScope, requested?: string | null): { locationId?: string | { in: string[] } } {
  if (scope.kind === 'none') return { locationId: NOTHING };
  if (scope.kind === 'location') return { locationId: scope.locationId };
  return requested ? { locationId: requested } : {};
}

/** Точка, к которой сведена область (для часового пояса и т. п.): своя у менеджера, запрошенная у администратора. */
export function scopeLocationId(scope: StaffScope, requested?: string | null): string | undefined {
  if (scope.kind === 'location') return scope.locationId;
  if (scope.kind === 'all') return requested || undefined;
  return undefined;
}

export function inScope(scope: StaffScope, locationId: string): boolean {
  return scope.kind === 'all' || (scope.kind === 'location' && scope.locationId === locationId);
}
