import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { EXPENSE_CATEGORIES, fromLocationDateTime, toLocationDate, type AdminBikeFinance, type AdminExpense, type AdminFinancePoint, type AdminFinanceSummary, type AdminListOf, type ExpenseCategory } from '@rental/shared';
import { badRequest, notFound } from '../../auth/api-errors';
import { writeAudit } from '../../bookings/audit';
import { Clock } from '../../jobs/clock';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminUser } from '../auth';
import { inScope, scopeLocationId, scopeWhere, staffScope } from '../../auth/staff-scope';
import { actorOf, asBody, has, int, oneOf, optStr } from '../fleet/input';
import { addBreakdown, bookingIncome, bookingOutstanding, EMPTY_BREAKDOWN, incomeTotal, overlapMs, periodKeys, toDays } from './calc';

const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366 * 5;
const MAX_AMOUNT = 2_000_000_000;
const EARNING = ['CONFIRMED', 'ISSUED', 'COMPLETED', 'PROBLEM'] as const;
const DAY_MS = 86_400_000;

const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
const asDate = (date: string) => new Date(`${date}T00:00:00Z`);

function parseDate(v: unknown, name: string): string {
  if (typeof v !== 'string' || !DATE_RE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw badRequest(`${name} must be YYYY-MM-DD`);
  return v;
}

const toExpense = (e: Prisma.ExpenseGetPayload<{ include: { bike: { select: { plate: true } } } }>): AdminExpense => ({
  id: e.id,
  date: e.date.toISOString().slice(0, 10),
  category: e.category,
  amount: e.amount,
  comment: e.comment,
  bikeId: e.bikeId,
  bikePlate: e.bike?.plate ?? null,
  locationId: e.locationId,
});

/** Финансы: администратор — по всем или одной точке, владелец — только своей (сегмент finance закрыт менеджеру в AdminAccessMiddleware). */
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  private async timezone(locationId?: string): Promise<string> {
    const loc = locationId
      ? await this.prisma.location.findUnique({ where: { id: locationId }, select: { timezone: true } })
      : await this.prisma.location.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { timezone: true } });
    return loc?.timezone ?? DEFAULT_TZ;
  }

  /** Период из запроса; по умолчанию текущий месяц по времени точки. */
  private async period(user: AdminUser, q: Record<string, unknown>) {
    const requested = typeof q.locationId === 'string' && q.locationId ? q.locationId : undefined;
    const staff = staffScope(user);
    const locationId = scopeLocationId(staff, requested);
    const scope = scopeWhere(staff, requested);
    const tz = await this.timezone(locationId);
    const today = toLocationDate(this.clock.now(), tz);
    const from = q.from !== undefined && q.from !== '' ? parseDate(q.from, 'from') : `${today.slice(0, 7)}-01`;
    const to = q.to !== undefined && q.to !== '' ? parseDate(q.to, 'to') : today;
    if (from > to) throw badRequest('from must not be after to');
    if ((Date.parse(to) - Date.parse(from)) / DAY_MS > MAX_DAYS) throw badRequest('Period is too long');
    return { from, to, tz, scope, fromAt: fromLocationDateTime(from, '00:00', tz), toAt: fromLocationDateTime(nextDay(to), '00:00', tz) };
  }

  async summary(user: AdminUser, q: Record<string, unknown>): Promise<AdminFinanceSummary> {
    const { from, to, tz, scope, fromAt, toAt } = await this.period(user, q);
    const [bookings, expenses, bikes, lifetimeBookings, lifetimeExpenses] = await Promise.all([
      this.prisma.booking.findMany({
        where: { ...scope, OR: [{ startAt: { gte: fromAt, lt: toAt } }, { status: { in: [...EARNING] }, startAt: { lt: toAt }, endAt: { gt: fromAt } }] },
        select: {
          bikeId: true, status: true, startAt: true, endAt: true, rentAmount: true, extrasAmount: true, deliveryAmount: true, discountAmount: true,
          totalAmount: true, depositAmount: true, lateFeeAmount: true, refundAmount: true,
          payments: { select: { kind: true, status: true, amount: true, receivedAmount: true } },
          deductions: { select: { amount: true } },
        },
      }),
      this.prisma.expense.findMany({ where: { ...scope, date: { gte: asDate(from), lte: asDate(to) } }, select: { bikeId: true, category: true, amount: true, date: true } }),
      this.prisma.bike.findMany({ where: scope, include: { model: { select: { name: true } } }, orderBy: { plate: 'asc' } }),
      this.prisma.booking.findMany({
        where: { ...scope, status: { in: [...EARNING, 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_SYSTEM'] } },
        select: {
          bikeId: true, status: true, rentAmount: true, extrasAmount: true, deliveryAmount: true, discountAmount: true, totalAmount: true, depositAmount: true, lateFeeAmount: true, refundAmount: true,
          payments: { select: { kind: true, status: true, amount: true, receivedAmount: true } },
          deductions: { select: { amount: true } },
        },
      }),
      this.prisma.expense.groupBy({ by: ['bikeId'], where: { ...scope, bikeId: { not: null } }, _sum: { amount: true } }),
    ]);

    const { granularity, keys } = periodKeys(from, to);
    const bucket = new Map<string, AdminFinancePoint>(keys.map((period) => [period, { period, income: 0, expenses: 0, profit: 0 }]));
    const keyOf = (date: string) => (granularity === 'day' ? date : date.slice(0, 7));

    const elapsedTo = new Date(Math.min(toAt.getTime(), this.clock.now().getTime()));
    const elapsedMs = Math.max(0, elapsedTo.getTime() - fromAt.getTime());
    const perBike = new Map<string, { bookings: number; ms: number; income: number; expenses: number }>();
    const bikeRow = (id: string) => {
      let r = perBike.get(id);
      if (!r) perBike.set(id, (r = { bookings: 0, ms: 0, income: 0, expenses: 0 }));
      return r;
    };

    let breakdown = EMPTY_BREAKDOWN;
    let outstanding = 0;
    for (const b of bookings) {
      const row = bikeRow(b.bikeId);
      if ((EARNING as readonly string[]).includes(b.status)) row.ms += overlapMs(b.startAt, b.endAt, fromAt, elapsedTo);
      if (b.startAt < fromAt || b.startAt >= toAt) continue; // только занятость; доход начислен в периоде начала брони
      const income = bookingIncome(b);
      const total = incomeTotal(income);
      breakdown = addBreakdown(breakdown, income);
      outstanding += bookingOutstanding(b);
      row.income += total;
      if ((EARNING as readonly string[]).includes(b.status)) row.bookings += 1;
      const point = bucket.get(keyOf(toLocationDate(b.startAt, tz)));
      if (point) point.income += total;
    }

    const byCategory = new Map<ExpenseCategory, number>();
    let expensesTotal = 0;
    for (const e of expenses) {
      expensesTotal += e.amount;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
      if (e.bikeId) bikeRow(e.bikeId).expenses += e.amount;
      const point = bucket.get(keyOf(e.date.toISOString().slice(0, 10)));
      if (point) point.expenses += e.amount;
    }

    const lifeIncome = new Map<string, number>();
    for (const b of lifetimeBookings) lifeIncome.set(b.bikeId, (lifeIncome.get(b.bikeId) ?? 0) + incomeTotal(bookingIncome(b)));
    const lifeExpense = new Map(lifetimeExpenses.map((e) => [e.bikeId as string, e._sum.amount ?? 0]));

    const bikeRows: AdminBikeFinance[] = bikes
      .filter((b) => b.status !== 'RETIRED' || perBike.has(b.id))
      .map((b) => {
        const r = bikeRow(b.id);
        const lifetimeProfit = (lifeIncome.get(b.id) ?? 0) - (lifeExpense.get(b.id) ?? 0);
        return {
          bikeId: b.id,
          plate: b.plate,
          modelName: b.model.name,
          status: b.status,
          bookings: r.bookings,
          rentedDays: toDays(r.ms),
          loadPercent: elapsedMs ? Math.min(100, Math.round((r.ms * 100) / elapsedMs)) : 0,
          income: r.income,
          expenses: r.expenses,
          profit: r.income - r.expenses,
          purchasePrice: b.purchasePrice,
          lifetimeProfit,
          paybackPercent: b.purchasePrice ? Math.round((lifetimeProfit * 100) / b.purchasePrice) : null,
        };
      })
      .sort((a, b) => b.profit - a.profit || a.plate.localeCompare(b.plate));

    const income = incomeTotal(breakdown);
    const profit = income - expensesTotal;
    return {
      from,
      to,
      timezone: tz,
      income,
      breakdown,
      expenses: expensesTotal,
      expensesByCategory: EXPENSE_CATEGORIES.filter((c) => byCategory.has(c))
        .map((category) => ({ category, amount: byCategory.get(category)! }))
        .sort((a, b) => b.amount - a.amount),
      profit,
      marginPercent: income > 0 ? Math.round((profit * 100) / income) : null,
      outstanding,
      granularity,
      series: [...bucket.values()].map((p) => ({ ...p, profit: p.income - p.expenses })),
      bikes: bikeRows,
    };
  }

  async expenses(user: AdminUser, q: Record<string, unknown>): Promise<AdminListOf<AdminExpense>> {
    const { from, to, scope } = await this.period(user, q);
    const rows = await this.prisma.expense.findMany({
      where: {
        ...scope,
        ...(typeof q.bikeId === 'string' && q.bikeId ? { bikeId: q.bikeId } : {}),
        date: { gte: asDate(from), lte: asDate(to) },
      },
      include: { bike: { select: { plate: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return { items: rows.map(toExpense), total: rows.length };
  }

  /** Байк определяет точку расхода; общий расход — на точку сотрудника, у администратора без выбора — на первую активную. */
  private async locationFor(user: AdminUser, bikeId: string | null): Promise<string | null> {
    const staff = staffScope(user);
    if (bikeId) {
      const bike = await this.prisma.bike.findFirst({ where: { id: bikeId, ...scopeWhere(staff) }, select: { locationId: true } });
      if (!bike) throw badRequest('Unknown bikeId');
      return bike.locationId;
    }
    const own = scopeLocationId(staff);
    if (own) return own;
    return (await this.prisma.location.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id ?? null;
  }

  async createExpense(user: AdminUser, body: unknown): Promise<AdminExpense> {
    const b = asBody(body);
    const bikeId = optStr(b.bikeId, 'bikeId', 40);
    const created = await this.prisma.expense.create({
      data: {
        date: asDate(parseDate(b.date, 'date')),
        category: oneOf(b.category, 'category', EXPENSE_CATEGORIES),
        amount: int(b.amount, 'amount', 1, MAX_AMOUNT),
        comment: optStr(b.comment, 'comment', 500),
        bikeId,
        locationId: await this.locationFor(user, bikeId),
        createdById: user.id,
      },
      include: { bike: { select: { plate: true } } },
    });
    await writeAudit(this.prisma, actorOf(user), 'expense.create', 'Expense', created.id, { amount: created.amount, category: created.category, bikeId });
    return toExpense(created);
  }

  private async visibleExpense(user: AdminUser, id: string) {
    const row = await this.prisma.expense.findUnique({ where: { id } });
    const staff = staffScope(user);
    if (!row || (staff.kind !== 'all' && !(row.locationId && inScope(staff, row.locationId)))) throw notFound('Expense not found');
    return row;
  }

  async updateExpense(user: AdminUser, id: string, body: unknown): Promise<AdminExpense> {
    const b = asBody(body);
    const before = await this.visibleExpense(user, id);
    const d: Prisma.ExpenseUncheckedUpdateInput = {};
    if (has(b, 'date')) d.date = asDate(parseDate(b.date, 'date'));
    if (has(b, 'category')) d.category = oneOf(b.category, 'category', EXPENSE_CATEGORIES);
    if (has(b, 'amount')) d.amount = int(b.amount, 'amount', 1, MAX_AMOUNT);
    if (has(b, 'comment')) d.comment = optStr(b.comment, 'comment', 500);
    if (has(b, 'bikeId')) {
      const bikeId = optStr(b.bikeId, 'bikeId', 40);
      d.bikeId = bikeId;
      d.locationId = await this.locationFor(user, bikeId);
    }
    const saved = await this.prisma.expense.update({ where: { id }, data: d, include: { bike: { select: { plate: true } } } });
    await writeAudit(this.prisma, actorOf(user), 'expense.update', 'Expense', id, { fields: Object.keys(d), amount: { from: before.amount, to: saved.amount } });
    return toExpense(saved);
  }

  async deleteExpense(user: AdminUser, id: string): Promise<void> {
    const before = await this.visibleExpense(user, id);
    await this.prisma.expense.delete({ where: { id } });
    await writeAudit(this.prisma, actorOf(user), 'expense.delete', 'Expense', id, { amount: before.amount, category: before.category, date: before.date.toISOString().slice(0, 10) });
  }

  /** Доход и расходы байка за всё время — для карточки в мониторинге. */
  async bikeLifetime(bikeId: string, purchasePrice: number | null) {
    const [rows, spent] = await Promise.all([
      this.prisma.booking.findMany({
        where: { bikeId, status: { in: [...EARNING, 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_SYSTEM'] } },
        select: {
          status: true, rentAmount: true, extrasAmount: true, deliveryAmount: true, discountAmount: true, totalAmount: true, depositAmount: true, lateFeeAmount: true, refundAmount: true,
          payments: { select: { kind: true, status: true, amount: true, receivedAmount: true } },
          deductions: { select: { amount: true } },
        },
      }),
      this.prisma.expense.aggregate({ where: { bikeId }, _sum: { amount: true } }),
    ]);
    const income = rows.reduce((s, b) => s + incomeTotal(bookingIncome(b)), 0);
    const expenses = spent._sum.amount ?? 0;
    const profit = income - expenses;
    return { income, expenses, profit, purchasePrice, paybackPercent: purchasePrice ? Math.round((profit * 100) / purchasePrice) : null };
  }
}

