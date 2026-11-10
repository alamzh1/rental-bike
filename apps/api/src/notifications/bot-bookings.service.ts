import { Injectable } from '@nestjs/common';
import type { Prisma, Role } from '@prisma/client';
import { formatDate, formatTime, pickText } from '@rental/i18n';
import type { I18nText, Lang } from '@rental/shared';
import { scopeWhere, staffScope, type StaffScope } from '../auth/staff-scope';
import { Clock } from '../jobs/clock';
import { PrismaService } from '../prisma/prisma.service';
import { renderBotText } from './notifier';

// Кнопки бота «Мои брони» и «Когда заканчиваются»: клиенту — его брони, сотруднику — брони его точки.

export type BotBookingsKind = 'my' | 'ending';

export interface BotBookingsReply {
  text: string;
  /** Кнопки под ответом: открыть бронь в Mini App */
  open: { code: string; startapp: string }[];
}

const CLIENT_ACTIVE = ['PENDING_PAYMENT', 'CONFIRMED', 'ISSUED', 'PROBLEM'] as const;
const STAFF_ACTIVE = ['CONFIRMED', 'ISSUED', 'PROBLEM'] as const;
const MAX_ROWS = 15;
const MAX_BUTTONS = 5;
const H = 3_600_000;
const INCLUDE = {
  model: { select: { name: true } },
  bike: { select: { plate: true } },
  location: { select: { name: true, timezone: true } },
  user: { select: { firstName: true, lastName: true, username: true, telegramId: true } },
} satisfies Prisma.BookingInclude;
type Row = Prisma.BookingGetPayload<{ include: typeof INCLUDE }>;

const adminIds = () => (process.env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((v) => v.trim()).filter(Boolean);

@Injectable()
export class BotBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  /** Сколько осталось до возврата или на сколько просрочено — считается в момент запроса. */
  private timeLeft(end: Date, lang: Lang): string {
    const ms = end.getTime() - this.clock.now().getTime();
    const hours = Math.floor(Math.abs(ms) / H);
    const span = hours >= 24 ? renderBotText('bot.bookings.spanDays', { lang, days: Math.floor(hours / 24), hours: hours % 24 }) : renderBotText('bot.bookings.spanHours', { lang, hours, minutes: Math.floor((Math.abs(ms) % H) / 60_000) });
    return renderBotText(ms < 0 ? 'bot.bookings.overdue' : 'bot.bookings.left', { lang, span });
  }

  private clientName(u: Row['user']): string {
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.username ? `@${u.username}` : u.telegramId);
  }

  private when(d: Date, lang: Lang, tz: string): string {
    return `${formatDate(d, lang, tz)} ${formatTime(d, lang, tz)}`;
  }

  private row(b: Row, kind: BotBookingsKind, lang: Lang, staff: boolean, allPoints: boolean): string {
    const tz = b.location.timezone;
    const lines = [`${b.code} · ${b.model.name}${staff ? ` · ${b.bike.plate}` : ''}`];
    if (allPoints) lines.push(pickText(b.location.name as I18nText, lang));
    if (staff) lines.push(this.clientName(b.user));
    if (kind === 'my') {
      lines.push(renderBotText(`bot.bookings.status.${b.status}`, { lang }));
      lines.push(renderBotText('bot.bookings.period', { lang, start: this.when(b.startAt, lang, tz), end: this.when(b.endAt, lang, tz) }));
    } else {
      lines.push(renderBotText('bot.bookings.until', { lang, end: this.when(b.endAt, lang, tz), left: this.timeLeft(b.endAt, lang) }));
    }
    return lines.join('\n');
  }

  async reply(telegramId: string, kind: BotBookingsKind, lang: Lang): Promise<BotBookingsReply> {
    const user = await this.prisma.user.findUnique({ where: { telegramId }, select: { id: true, role: true, locationId: true } });
    const role: Role | null = adminIds().includes(telegramId) ? 'ADMIN' : (user?.role ?? null);
    const staff = role === 'ADMIN' || role === 'OWNER' || role === 'MANAGER';
    const scope: StaffScope = staff ? staffScope({ role, locationId: role === 'ADMIN' ? null : user?.locationId }) : { kind: 'none' };
    if (!staff && !user) return { text: renderBotText(`bot.bookings.empty.${kind}`, { lang }), open: [] };

    const who: Prisma.BookingWhereInput = staff ? scopeWhere(scope) : { userId: user!.id };
    const where: Prisma.BookingWhereInput = kind === 'ending' ? { ...who, status: 'ISSUED' } : { ...who, status: { in: [...(staff ? STAFF_ACTIVE : CLIENT_ACTIVE)] } };
    const rows = await this.prisma.booking.findMany({ where, include: INCLUDE, orderBy: kind === 'ending' ? { endAt: 'asc' } : { startAt: 'asc' }, take: MAX_ROWS + 1 });
    if (!rows.length) return { text: renderBotText(`bot.bookings.empty.${staff ? `${kind}Staff` : kind}`, { lang }), open: [] };

    const shown = rows.slice(0, MAX_ROWS);
    const title = renderBotText(`bot.bookings.title.${staff ? `${kind}Staff` : kind}`, { lang });
    const body = shown.map((b) => this.row(b, kind, lang, staff, scope.kind === 'all')).join('\n\n');
    const more = rows.length > MAX_ROWS ? `\n\n${renderBotText('bot.bookings.more', { lang, count: MAX_ROWS })}` : '';
    return { text: `${title}\n\n${body}${more}`, open: staff ? [] : shown.slice(0, MAX_BUTTONS).map((b) => ({ code: b.code, startapp: `booking_${b.id}` })) };
  }
}
