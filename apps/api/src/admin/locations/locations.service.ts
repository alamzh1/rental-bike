import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AdminListOf, AdminLocation, AdminLocationPayos, I18nText } from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest, forbidden, notFound } from '../../auth/api-errors';
import { inScope, staffScope } from '../../auth/staff-scope';
import { apiError } from '../../bookings/errors';
import { writeAudit } from '../../bookings/audit';
import { NotificationsService } from '../../notifications/notifications.service';
import { locationPayOsConfig, locationWebhookUrl } from '../../payments/location-accounts';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../../payments/payment-provider';
import { PayOsProvider } from '../../payments/payos-provider';
import { paymentKeysConfigured, sealSecret } from '../../payments/secret-box';
import { displayName, type AdminUser } from '../auth';
import { actorOf, asBody, bool, has, i18nText, num, optStr, str } from '../fleet/input';

// Точки выдачи: адрес, координаты, часы работы, часовой пояс, сотрудники (User.role = MANAGER | OWNER, User.locationId), счёт оплаты.

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const INCLUDE = { managers: { where: { role: { in: ['MANAGER', 'OWNER'] } }, orderBy: { firstName: 'asc' } } } satisfies Prisma.LocationInclude;
type Row = Prisma.LocationGetPayload<{ include: typeof INCLUDE }>;

const toStaff = (m: Row['managers'][number]) => ({ id: m.id, name: displayName(m), username: m.username, telegramId: m.telegramId });

function payosOf(l: Row, platform: PaymentProvider): AdminLocationPayos {
  const own = !!(l.payosClientId && l.payosApiKey && l.payosChecksumKey);
  const account = own ? 'own' : platform.name === 'payos' ? 'platform' : platform.name === 'test' ? 'test' : 'off';
  return { account, clientId: l.payosClientId, webhookConfirmedAt: l.payosWebhookAt?.toISOString() ?? null, webhookUrl: locationWebhookUrl(l.id) };
}

const toLocation = (l: Row, platform: PaymentProvider): AdminLocation => ({
  id: l.id,
  name: l.name as I18nText,
  address: l.address,
  lat: l.lat,
  lng: l.lng,
  openTime: l.openTime,
  closeTime: l.closeTime,
  timezone: l.timezone,
  isActive: l.isActive,
  isDemo: l.isDemo,
  contact: l.contact,
  legalName: l.legalName,
  managers: l.managers.filter((m) => m.role === 'MANAGER').map(toStaff),
  owners: l.managers.filter((m) => m.role === 'OWNER').map(toStaff),
  payos: payosOf(l, platform),
});

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class LocationsService {
  private readonly log = new Logger('Locations');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly platform: PaymentProvider,
    private readonly notifications: NotificationsService,
  ) {}

  /** Счёт, на который идут деньги клиентов, сменил не администратор: он должен об этом знать. */
  private async payosNotice(user: AdminUser, id: string): Promise<void> {
    if (user.role === 'ADMIN') return;
    const row = await this.prisma.location.findUnique({ where: { id }, select: { address: true } });
    await this.notifications.adminNotice('bot.admin.payosChanged', { name: user.name, address: row?.address ?? id });
  }

  /** Администратору — все точки и в режиме одной точки (нужен список для переключателя); владельцу — только своя. */
  async list(user: AdminUser): Promise<AdminListOf<AdminLocation>> {
    const where = user.role === 'ADMIN' ? {} : { id: user.locationId ?? { in: [] } };
    const rows = await this.prisma.location.findMany({ where, include: INCLUDE, orderBy: { createdAt: 'asc' } });
    return { items: rows.map((r) => toLocation(r, this.platform)), total: rows.length };
  }

  private assertOwn(user: AdminUser, id: string): void {
    if (user.role !== 'ADMIN' && !inScope(staffScope(user), id)) throw notFound('Location not found');
  }

  private async one(id: string): Promise<AdminLocation> {
    const row = await this.prisma.location.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw notFound('Location not found');
    return toLocation(row, this.platform);
  }

  async save(user: AdminUser, id: string | null, body: unknown): Promise<AdminLocation> {
    if (id) this.assertOwn(user, id);
    const b = asBody(body);
    // Закрыть точку целиком может только администратор
    if (user.role !== 'ADMIN' && has(b, 'isActive')) throw forbidden('Only an administrator can close a location');
    const d: Prisma.LocationUpdateInput = {};
    const need = (k: string) => !id || has(b, k);
    if (need('name')) d.name = i18nText(b.name, 'name', { max: 80 }) as Prisma.InputJsonObject;
    if (need('address')) d.address = str(b.address, 'address', 300);
    if (need('lat')) d.lat = num(b.lat, 'lat', -90, 90);
    if (need('lng')) d.lng = num(b.lng, 'lng', -180, 180);
    for (const k of ['openTime', 'closeTime'] as const) {
      if (has(b, k)) {
        if (typeof b[k] !== 'string' || !HHMM.test(b[k])) throw badRequest(`${k} must be HH:mm`);
        d[k] = b[k];
      }
    }
    if (has(b, 'timezone')) {
      const tz = str(b.timezone, 'timezone', 60);
      if (!validTimezone(tz)) throw badRequest('Unknown timezone');
      d.timezone = tz;
    }
    if (has(b, 'isActive')) d.isActive = bool(b.isActive, 'isActive');
    if (has(b, 'contact')) d.contact = optStr(b.contact, 'contact', 200);
    if (has(b, 'legalName')) d.legalName = optStr(b.legalName, 'legalName', 500);
    const current = id ? await this.prisma.location.findUnique({ where: { id }, select: { openTime: true, closeTime: true } }) : null;
    if (id && !current) throw notFound('Location not found');
    const open = (d.openTime as string | undefined) ?? current?.openTime ?? '08:00';
    const close = (d.closeTime as string | undefined) ?? current?.closeTime ?? '20:00';
    if (open >= close) throw badRequest('openTime must be before closeTime');
    const row = id ? await this.prisma.location.update({ where: { id }, data: { ...d, isDemo: false } }) : await this.prisma.location.create({ data: { ...(d as Prisma.LocationCreateInput), isDemo: false } });
    await writeAudit(this.prisma, actorOf(user), id ? 'location.update' : 'location.create', 'Location', row.id, { fields: Object.keys(d) });
    return this.one(row.id);
  }

  /** Назначить сотрудника по Telegram ID: пользователь создаётся, если ещё не открывал бота. Админа не понижаем. */
  private async assign(user: AdminUser, id: string, body: unknown, role: 'MANAGER' | 'OWNER'): Promise<AdminLocation> {
    this.assertOwn(user, id);
    const telegramId = str(asBody(body).telegramId, 'telegramId', 20);
    if (!/^\d{3,20}$/.test(telegramId)) throw badRequest('telegramId must be digits');
    if (!(await this.prisma.location.count({ where: { id } }))) throw notFound('Location not found');
    const existing = await this.prisma.user.findUnique({ where: { telegramId } });
    if (existing?.role === 'ADMIN') throw badRequest('User is an administrator');
    // Владелец нанимает только своих: чужого сотрудника и другого владельца забрать себе нельзя
    if (user.role !== 'ADMIN' && existing && (existing.role === 'OWNER' || (existing.role === 'MANAGER' && existing.locationId !== id))) throw apiError(HttpStatus.CONFLICT, 'STAFF_TAKEN', 'User works at another location');
    const m = await this.prisma.user.upsert({ where: { telegramId }, create: { telegramId, role, locationId: id }, update: { role, locationId: id } });
    await writeAudit(this.prisma, actorOf(user), role === 'OWNER' ? 'location.owner.add' : 'location.manager.add', 'Location', id, { userId: m.id, telegramId });
    return this.one(id);
  }

  private async unassign(user: AdminUser, id: string, userId: string, role: 'MANAGER' | 'OWNER'): Promise<AdminLocation> {
    this.assertOwn(user, id);
    const m = await this.prisma.user.findFirst({ where: { id: userId, locationId: id, role } });
    if (!m) throw notFound(role === 'OWNER' ? 'Owner not found' : 'Manager not found');
    await this.prisma.user.update({ where: { id: userId }, data: { role: 'CLIENT', locationId: null } });
    await writeAudit(this.prisma, actorOf(user), role === 'OWNER' ? 'location.owner.remove' : 'location.manager.remove', 'Location', id, { userId });
    return this.one(id);
  }

  addManager(user: AdminUser, id: string, body: unknown): Promise<AdminLocation> {
    return this.assign(user, id, body, 'MANAGER');
  }

  /** Снять менеджера с точки: роль возвращается в CLIENT, сессии админки перестают проходить проверку роли. */
  removeManager(user: AdminUser, id: string, userId: string): Promise<AdminLocation> {
    return this.unassign(user, id, userId, 'MANAGER');
  }

  addOwner(user: AdminUser, id: string, body: unknown): Promise<AdminLocation> {
    return this.assign(user, id, body, 'OWNER');
  }

  removeOwner(user: AdminUser, id: string, userId: string): Promise<AdminLocation> {
    return this.unassign(user, id, userId, 'OWNER');
  }

  /**
   * Свой счёт payOS: ключи сначала сохраняются, потому что при подтверждении payOS сразу шлёт пробный webhook,
   * подписанный этим каналом. Не прошло подтверждение — прежние ключи возвращаются и счёт точки не меняется.
   */
  async setPayos(user: AdminUser, id: string, body: unknown): Promise<AdminLocation> {
    this.assertOwn(user, id);
    if (!paymentKeysConfigured()) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'PAYMENT_KEYS_SECRET_MISSING', 'PAYMENT_KEYS_SECRET is not set');
    const b = asBody(body);
    const clientId = str(b.clientId, 'clientId', 100);
    const apiKey = str(b.apiKey, 'apiKey', 200);
    const checksumKey = str(b.checksumKey, 'checksumKey', 200);
    const before = await this.prisma.location.findUnique({ where: { id }, select: { payosClientId: true, payosApiKey: true, payosChecksumKey: true, payosWebhookAt: true } });
    if (!before) throw notFound('Location not found');
    const sealed = { payosClientId: clientId, payosApiKey: sealSecret(apiKey), payosChecksumKey: sealSecret(checksumKey) };
    await this.prisma.location.update({ where: { id }, data: { ...sealed, payosWebhookAt: null } });
    const url = locationWebhookUrl(id);
    let confirmed = false;
    if (url.startsWith('https://')) {
      try {
        await new PayOsProvider(locationPayOsConfig(sealed)!).confirmWebhook(url);
        confirmed = true;
      } catch (e) {
        this.log.warn(`Ключи payOS точки ${id} не приняты: ${(e as Error).message}`);
        await this.prisma.location.update({ where: { id }, data: before });
        throw apiError(HttpStatus.BAD_REQUEST, 'PAYOS_KEYS_REJECTED', 'payOS did not accept these keys or the webhook address');
      }
    }
    if (confirmed) await this.prisma.location.update({ where: { id }, data: { payosWebhookAt: new Date() } });
    // Сами ключи в журнал не пишутся
    await writeAudit(this.prisma, actorOf(user), 'location.payos.set', 'Location', id, { clientId, confirmed });
    await this.payosNotice(user, id);
    return this.one(id);
  }

  /** Отключить свой счёт: оплаты точки идут по общим настройкам. */
  async clearPayos(user: AdminUser, id: string): Promise<AdminLocation> {
    this.assertOwn(user, id);
    if (!(await this.prisma.location.count({ where: { id } }))) throw notFound('Location not found');
    await this.prisma.location.update({ where: { id }, data: { payosClientId: null, payosApiKey: null, payosChecksumKey: null, payosWebhookAt: null } });
    await writeAudit(this.prisma, actorOf(user), 'location.payos.clear', 'Location', id);
    await this.payosNotice(user, id);
    return this.one(id);
  }
}
