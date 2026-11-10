import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type Extra, type SeasonRule } from '@prisma/client';
import type { AdminExtra, AdminListOf, AdminModelTariffs, AdminSeason, AdminTariff, I18nText } from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest, notFound } from '../../auth/api-errors';
import { apiError } from '../../bookings/errors';
import { writeAudit } from '../../bookings/audit';
import type { AdminUser } from '../auth';
import { inScope, scopeWhere, staffScope } from '../../auth/staff-scope';
import { actorOf, asBody, bool, has, i18nText, int, num, oneOf, optStr, str, ymd } from '../fleet/input';

// Цены: тарифы по длительности (на модель), сезонные коэффициенты на диапазон дат, опции. Цена доставки — в настройках.
// Расчёт — только shared.quote через PricingService: изменения видны в POST /quotes сразу.

const tariffsInvalid = (message: string) => apiError(HttpStatus.BAD_REQUEST, 'TARIFFS_INVALID', message);

/**
 * Тарифная сетка: от 1 суток, без пропусков и пересечений, открытая граница (maxDays = null) — только у последней.
 * Возвращает отсортированную копию или бросает 400 TARIFFS_INVALID.
 */
export function validateTariffs(raw: unknown): AdminTariff[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 12) throw tariffsInvalid('tariffs must be a non-empty array (≤ 12)');
  const list = raw.map((t, i) => {
    const o = asBody(t);
    const minDays = int(o.minDays, `tariffs[${i}].minDays`, 1, 3650);
    const maxDays = o.maxDays === null || o.maxDays === undefined ? null : int(o.maxDays, `tariffs[${i}].maxDays`, minDays, 3650);
    const pricePerDay = int(o.pricePerDay, `tariffs[${i}].pricePerDay`, 1, 100_000_000);
    return { minDays, maxDays, pricePerDay };
  });
  list.sort((a, b) => a.minDays - b.minDays);
  if (list[0]!.minDays !== 1) throw tariffsInvalid('The first bracket must start at 1 day');
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1]!;
    if (prev.maxDays === null || prev.maxDays + 1 !== list[i]!.minDays) throw tariffsInvalid(`Brackets must be contiguous: ${prev.minDays}–${prev.maxDays ?? '∞'} then ${list[i]!.minDays}`);
  }
  return list;
}

const ymdOf = (d: Date) => d.toISOString().slice(0, 10);

const toSeason = (s: SeasonRule): AdminSeason => ({
  id: s.id,
  locationId: s.locationId,
  name: s.name as I18nText,
  from: ymdOf(s.from),
  to: ymdOf(s.to),
  coefficient: s.coefficient,
  isDemo: s.isDemo,
});

const toExtra = (e: Extra): AdminExtra => ({
  id: e.id,
  code: e.code,
  name: e.name as I18nText,
  price: e.price,
  per: e.per,
  maxQty: e.maxQty,
  sortOrder: e.sortOrder,
  isActive: e.isActive,
  isDemo: e.isDemo,
});

@Injectable()
export class PricesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Тарифы ----------

  async tariffs(user: AdminUser): Promise<AdminListOf<AdminModelTariffs>> {
    const rows = await this.prisma.bikeModel.findMany({ where: scopeWhere(staffScope(user)), include: { tariffs: { orderBy: { minDays: 'asc' } } }, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
    const items = rows.map((m) => ({
      modelId: m.id,
      modelName: m.name,
      deposit: m.deposit,
      isDemo: m.isDemo || m.tariffs.some((t) => t.isDemo),
      tariffs: m.tariffs.map((t) => ({ minDays: t.minDays, maxDays: t.maxDays, pricePerDay: t.pricePerDay })),
    }));
    return { items, total: items.length };
  }

  /** Заменить сетку тарифов модели целиком (и депозит, если передан). Снимает «ДЕМО» с тарифов. */
  async setTariffs(user: AdminUser, modelId: string, body: unknown): Promise<AdminModelTariffs> {
    const b = asBody(body);
    const list = validateTariffs(b.tariffs);
    const deposit = has(b, 'deposit') ? int(b.deposit, 'deposit', 0, 1_000_000_000) : undefined;
    const model = await this.prisma.bikeModel.findFirst({ where: { id: modelId, ...scopeWhere(staffScope(user)) }, include: { tariffs: { orderBy: { minDays: 'asc' } } } });
    if (!model) throw notFound('Model not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.tariff.deleteMany({ where: { modelId } });
      await tx.tariff.createMany({ data: list.map((t) => ({ ...t, modelId, isDemo: false })) });
      if (deposit !== undefined) await tx.bikeModel.update({ where: { id: modelId }, data: { deposit, isDemo: false } });
      await writeAudit(tx, actorOf(user), 'tariffs.update', 'BikeModel', modelId, {
        from: model.tariffs.map((t) => ({ minDays: t.minDays, maxDays: t.maxDays, pricePerDay: t.pricePerDay })),
        to: list,
        ...(deposit !== undefined ? { deposit: { from: model.deposit, to: deposit } } : {}),
      });
    });
    const after = await this.prisma.bikeModel.findUniqueOrThrow({ where: { id: modelId }, select: { deposit: true, isDemo: true } });
    return { modelId, modelName: model.name, deposit: after.deposit, isDemo: after.isDemo, tariffs: list };
  }

  // ---------- Сезоны ----------

  /** Сезоны точки и общие: общие тоже меняют её цены, поэтому владелец их видит, но не правит. */
  async seasons(user: AdminUser): Promise<AdminListOf<AdminSeason>> {
    const scope = staffScope(user);
    const where: Prisma.SeasonRuleWhereInput = scope.kind === 'location' ? { OR: [{ locationId: scope.locationId }, { locationId: null }] } : scope.kind === 'none' ? { id: { in: [] } } : {};
    const rows = await this.prisma.seasonRule.findMany({ where, orderBy: { from: 'asc' } });
    return { items: rows.map(toSeason), total: rows.length };
  }

  private seasonData(b: Record<string, unknown>, creating: boolean): Prisma.SeasonRuleUncheckedUpdateInput {
    const d: Prisma.SeasonRuleUncheckedUpdateInput = {};
    if (creating || has(b, 'name')) d.name = i18nText(b.name, 'name', { max: 80 }) as Prisma.InputJsonObject;
    if (creating || has(b, 'from')) d.from = ymd(b.from, 'from');
    if (creating || has(b, 'to')) d.to = ymd(b.to, 'to');
    if (creating || has(b, 'coefficient')) d.coefficient = Math.round(num(b.coefficient, 'coefficient', 0.1, 10) * 100) / 100;
    if (has(b, 'locationId')) d.locationId = optStr(b.locationId, 'locationId');
    return d;
  }

  /** Владелец правит только сезоны своей точки. Администратор — любые. */
  private async assertSeasonEditable(user: AdminUser, row: SeasonRule): Promise<void> {
    if (user.role !== 'ADMIN' && !(row.locationId && inScope(staffScope(user), row.locationId))) throw notFound('Season not found');
  }

  async saveSeason(user: AdminUser, id: string | null, body: unknown): Promise<AdminSeason> {
    const d = this.seasonData(asBody(body), !id);
    const scope = staffScope(user);
    // Сезон, созданный или правленный из одной точки, остаётся за ней: общие сезоны заводятся только в режиме «все точки»
    if (scope.kind === 'location' && (!id || user.role !== 'ADMIN')) d.locationId = scope.locationId;
    const current = id ? await this.prisma.seasonRule.findUnique({ where: { id } }) : null;
    if (id && !current) throw notFound('Season not found');
    if (current) await this.assertSeasonEditable(user, current);
    const from = (d.from as Date | undefined) ?? current?.from;
    const to = (d.to as Date | undefined) ?? current?.to;
    if (from && to && from.getTime() > to.getTime()) throw badRequest('from must be on or before to');
    if (typeof d.locationId === 'string' && !(await this.prisma.location.count({ where: { id: d.locationId } }))) throw badRequest('Unknown locationId');
    const row = id
      ? await this.prisma.seasonRule.update({ where: { id }, data: { ...d, isDemo: false } })
      : await this.prisma.seasonRule.create({ data: { ...(d as Prisma.SeasonRuleUncheckedCreateInput), isDemo: false } });
    await writeAudit(this.prisma, actorOf(user), id ? 'season.update' : 'season.create', 'SeasonRule', row.id, { from: ymdOf(row.from), to: ymdOf(row.to), coefficient: row.coefficient });
    return toSeason(row);
  }

  async deleteSeason(user: AdminUser, id: string): Promise<void> {
    const row = await this.prisma.seasonRule.findUnique({ where: { id } });
    if (!row) throw notFound('Season not found');
    await this.assertSeasonEditable(user, row);
    await this.prisma.seasonRule.delete({ where: { id } });
    await writeAudit(this.prisma, actorOf(user), 'season.delete', 'SeasonRule', id, { from: ymdOf(row.from), to: ymdOf(row.to), coefficient: row.coefficient });
  }

  // ---------- Опции ----------

  async extras(): Promise<AdminListOf<AdminExtra>> {
    const rows = await this.prisma.extra.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
    return { items: rows.map(toExtra), total: rows.length };
  }

  async saveExtra(user: AdminUser, id: string | null, body: unknown): Promise<AdminExtra> {
    const b = asBody(body);
    const d: Prisma.ExtraUpdateInput = {};
    if (!id || has(b, 'code')) d.code = str(b.code, 'code', 40).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!id || has(b, 'name')) d.name = i18nText(b.name, 'name', { max: 80 }) as Prisma.InputJsonObject;
    if (!id || has(b, 'price')) d.price = int(b.price, 'price', 0, 100_000_000);
    if (!id || has(b, 'per')) d.per = oneOf(b.per, 'per', ['DAY', 'ONCE'] as const);
    if (has(b, 'maxQty')) d.maxQty = int(b.maxQty, 'maxQty', 1, 10);
    if (has(b, 'sortOrder')) d.sortOrder = int(b.sortOrder, 'sortOrder', 0, 10_000);
    if (has(b, 'isActive')) d.isActive = bool(b.isActive, 'isActive');
    try {
      const row = id ? await this.prisma.extra.update({ where: { id }, data: { ...d, isDemo: false } }) : await this.prisma.extra.create({ data: { ...(d as Prisma.ExtraCreateInput), isDemo: false } });
      await writeAudit(this.prisma, actorOf(user), id ? 'extra.update' : 'extra.create', 'Extra', row.id, { code: row.code, price: row.price, per: row.per, isActive: row.isActive });
      return toExtra(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw apiError(HttpStatus.CONFLICT, 'VALIDATION', 'Extra with this code exists');
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw notFound('Extra not found');
      throw e;
    }
  }
}
