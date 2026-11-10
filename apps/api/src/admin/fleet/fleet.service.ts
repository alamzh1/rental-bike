import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type Bike, type BikeModel, type Brand } from '@prisma/client';
import {
  ADMIN_MODEL_CATEGORIES,
  ADMIN_TRANSMISSIONS,
  BIKE_STATUSES,
  MODEL_FEATURES,
  canSeeMoney,
  type AdminBike,
  type AdminBrand,
  type AdminListOf,
  type AdminModel,
  type AdminModelPhoto,
  type BikeDocKind,
  type BikeDocUpload,
  type DocumentUrlResponse,
  type I18nText,
} from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest, forbidden, notFound } from '../../auth/api-errors';
import { scopeLocationId, scopeWhere, staffScope } from '../../auth/staff-scope';
import { apiError, assertBikeCanStop } from '../../bookings/errors';
import { writeAudit } from '../../bookings/audit';
import { STORAGE, type Storage } from '../../documents/storage/storage';
import { publicFileUrl, toPhotos } from '../../catalog/public-url';
import type { AdminUser } from '../auth';
import { convertPhoto, deletePublic, storePhoto, writePublic, type RawUpload } from './images';
import { actorOf, asBody, bool, has, i18nText, int, oneOf, optI18nText, optInstant, optInt, optNum, optStr, str, type Body } from './input';

// Парк: бренды, модели (фото → WebP/AVIF, тексты на 3 языках, депозит, тарифы), байки (номер, VIN, пробег, статус, ТО,
// страховка, документы в приватном хранилище). Менеджер видит парк своей точки без цен и меняет только состояние байка.

const DOC_TTL_SEC = 600;
const DOC_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MANAGER_BIKE_FIELDS = new Set(['status', 'readyAt', 'mileageKm', 'serviceDate']);

const MODEL_INCLUDE = { brand: { select: { name: true } }, location: { select: { name: true } }, tariffs: { orderBy: { minDays: 'asc' } }, _count: { select: { bikes: true } } } satisfies Prisma.BikeModelInclude;
type ModelRow = BikeModel & Prisma.BikeModelGetPayload<{ include: typeof MODEL_INCLUDE }>;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'model';

type StoredPhoto = { key: string; alt?: I18nText; demo?: boolean; sizes: Record<string, { webp: string; avif?: string }> };

function storedPhotos(raw: unknown): StoredPhoto[] {
  return Array.isArray(raw) ? (raw.filter((p) => p && typeof p === 'object' && typeof (p as StoredPhoto).key === 'string') as StoredPhoto[]) : [];
}

const isUniqueViolation = (e: unknown, field: string) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && JSON.stringify(e.meta ?? {}).includes(field);

export function toAdminModel(m: ModelRow, withPrices: boolean): AdminModel {
  const stored = storedPhotos(m.photos);
  const photos: AdminModelPhoto[] = [];
  // toPhotos пропускает битые записи — сопоставляем по ключу, чтобы удаление попадало в нужную
  for (const p of stored) {
    const view = toPhotos([p])[0];
    if (view) photos.push({ ...view, key: p.key, demo: p.demo === true });
  }
  const base: AdminModel = {
    id: m.id,
    locationId: m.locationId,
    locationName: m.location.name as I18nText,
    brandId: m.brandId,
    brandName: m.brand.name,
    name: m.name,
    slug: m.slug,
    category: m.category,
    transmission: m.transmission,
    engineCc: m.engineCc,
    year: m.year,
    description: m.description as I18nText,
    photos,
    fuelConsumption: m.fuelConsumption,
    tankLiters: m.tankLiters,
    maxSpeedKmh: m.maxSpeedKmh,
    seats: m.seats,
    features: m.features,
    included: Array.isArray(m.included) ? (m.included as I18nText[]) : [],
    conditions: (m.conditions as I18nText | null) ?? null,
    licenseRequired: m.licenseRequired,
    isActive: m.isActive,
    isDemo: m.isDemo,
    bikeCount: m._count.bikes,
  };
  if (!withPrices) return base;
  return { ...base, deposit: m.deposit, tariffs: m.tariffs.map((t) => ({ minDays: t.minDays, maxDays: t.maxDays, pricePerDay: t.pricePerDay })) };
}

export function toAdminBike(b: Bike & { model: { name: string } }, admin = false): AdminBike {
  return {
    ...(admin ? { purchasePrice: b.purchasePrice } : {}),
    id: b.id,
    modelId: b.modelId,
    modelName: b.model.name,
    locationId: b.locationId,
    plate: b.plate,
    vin: b.vin,
    mileageKm: b.mileageKm,
    status: b.status,
    readyAt: b.readyAt?.toISOString() ?? null,
    serviceDate: b.serviceDate?.toISOString() ?? null,
    insuranceUntil: b.insuranceUntil?.toISOString() ?? null,
    hasRegistrationDoc: !!b.registrationDocKey,
    hasInsuranceDoc: !!b.insuranceDocKey,
    isDemo: b.isDemo,
  };
}

const toBrand = (b: Brand): AdminBrand => ({ id: b.id, name: b.name, logoUrl: b.logoKey ? publicFileUrl(b.logoKey) : null, sortOrder: b.sortOrder });

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  /** Менеджер — только парк своей точки, менеджер без точки — ничего. */
  private scope(user: AdminUser): { locationId?: string | { in: string[] } } {
    return scopeWhere(staffScope(user));
  }

  // ---------- Бренды ----------

  async brands(): Promise<AdminListOf<AdminBrand>> {
    const rows = await this.prisma.brand.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return { items: rows.map(toBrand), total: rows.length };
  }

  async saveBrand(user: AdminUser, id: string | null, body: unknown): Promise<AdminBrand> {
    const b = asBody(body);
    const data: Prisma.BrandUpdateInput = {};
    if (!id || has(b, 'name')) data.name = str(b.name, 'name', 60);
    if (has(b, 'sortOrder')) data.sortOrder = int(b.sortOrder, 'sortOrder', 0, 10_000);
    try {
      const row = id ? await this.prisma.brand.update({ where: { id }, data }) : await this.prisma.brand.create({ data: data as Prisma.BrandCreateInput });
      await writeAudit(this.prisma, actorOf(user), id ? 'brand.update' : 'brand.create', 'Brand', row.id, data as Record<string, unknown>);
      return toBrand(row);
    } catch (e) {
      if (isUniqueViolation(e, 'name')) throw apiError(HttpStatus.CONFLICT, 'VALIDATION', 'Brand with this name exists');
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw notFound('Brand not found');
      throw e;
    }
  }

  /** Логотип бренда: WebP 400 px по ширине (прозрачность сохраняется). */
  async brandLogo(user: AdminUser, id: string, upload: RawUpload): Promise<AdminBrand> {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw notFound('Brand not found');
    const img = await convertPhoto(upload.body, [400]);
    const key = `brands/${brand.id}/logo-${randomBytes(4).toString('hex')}.webp`;
    await writePublic(key, img.sizes['400']!.webp, 'image/webp');
    const row = await this.prisma.brand.update({ where: { id }, data: { logoKey: key } });
    if (brand.logoKey?.startsWith(`brands/${brand.id}/`)) await deletePublic(brand.logoKey);
    await writeAudit(this.prisma, actorOf(user), 'brand.logo', 'Brand', id, { key });
    return toBrand(row);
  }

  // ---------- Модели ----------

  async models(user: AdminUser, q: Record<string, unknown>): Promise<AdminListOf<AdminModel>> {
    const where: Prisma.BikeModelWhereInput = {
      ...scopeWhere(staffScope(user), typeof q.locationId === 'string' ? q.locationId : undefined),
    };
    const rows = await this.prisma.bikeModel.findMany({ where, include: MODEL_INCLUDE, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
    return { items: rows.map((m) => toAdminModel(m, canSeeMoney(user.role))), total: rows.length };
  }

  async model(user: AdminUser, id: string): Promise<AdminModel> {
    const m = await this.prisma.bikeModel.findFirst({ where: { id, ...this.scope(user) }, include: MODEL_INCLUDE });
    if (!m) throw notFound('Model not found');
    return toAdminModel(m, canSeeMoney(user.role));
  }

  private modelData(b: Body, creating: boolean): Prisma.BikeModelUncheckedUpdateInput {
    const d: Prisma.BikeModelUncheckedUpdateInput = {};
    const need = (k: string) => creating || has(b, k);
    if (need('locationId')) d.locationId = str(b.locationId, 'locationId');
    if (need('brandId')) d.brandId = str(b.brandId, 'brandId');
    if (need('name')) d.name = str(b.name, 'name', 80);
    if (need('category')) d.category = oneOf(b.category, 'category', ADMIN_MODEL_CATEGORIES);
    if (need('transmission')) d.transmission = oneOf(b.transmission, 'transmission', ADMIN_TRANSMISSIONS);
    if (need('description')) d.description = i18nText(b.description, 'description', { max: 4000 }) as Prisma.InputJsonObject;
    if (need('deposit')) d.deposit = int(b.deposit, 'deposit', 0, 1_000_000_000);
    if (has(b, 'engineCc')) d.engineCc = optInt(b.engineCc, 'engineCc', 0, 3000);
    if (has(b, 'year')) d.year = optInt(b.year, 'year', 1950, 2100);
    if (has(b, 'fuelConsumption')) d.fuelConsumption = optNum(b.fuelConsumption, 'fuelConsumption', 0, 50);
    if (has(b, 'tankLiters')) d.tankLiters = optNum(b.tankLiters, 'tankLiters', 0, 100);
    if (has(b, 'maxSpeedKmh')) d.maxSpeedKmh = optInt(b.maxSpeedKmh, 'maxSpeedKmh', 0, 400);
    if (has(b, 'seats')) d.seats = int(b.seats, 'seats', 1, 3);
    if (has(b, 'features')) {
      if (!Array.isArray(b.features)) throw badRequest('features must be an array');
      d.features = [...new Set(b.features.map((f) => oneOf(f, 'features[]', MODEL_FEATURES as readonly string[])))];
    }
    if (has(b, 'included')) {
      if (!Array.isArray(b.included) || b.included.length > 20) throw badRequest('included must be an array (≤ 20)');
      d.included = b.included.map((x, i) => i18nText(x, `included[${i}]`, { max: 200 })) as Prisma.InputJsonArray;
    }
    if (has(b, 'conditions')) {
      const c = optI18nText(b.conditions, 'conditions', { max: 2000 });
      d.conditions = c === null ? Prisma.DbNull : (c as Prisma.InputJsonObject);
    }
    if (has(b, 'licenseRequired')) d.licenseRequired = oneOf(b.licenseRequired, 'licenseRequired', ['A1', 'A', 'NONE'] as const);
    if (has(b, 'isActive')) d.isActive = bool(b.isActive, 'isActive');
    return d;
  }

  private async assertRefs(d: Prisma.BikeModelUncheckedUpdateInput): Promise<void> {
    if (typeof d.locationId === 'string' && !(await this.prisma.location.count({ where: { id: d.locationId } }))) throw badRequest('Unknown locationId');
    if (typeof d.brandId === 'string' && !(await this.prisma.brand.count({ where: { id: d.brandId } }))) throw badRequest('Unknown brandId');
  }

  /** Точка модели: у сотрудника и у администратора в режиме одной точки — всегда она. */
  private ownLocation(user: AdminUser, d: Prisma.BikeModelUncheckedUpdateInput): void {
    const own = scopeLocationId(staffScope(user));
    if (own) d.locationId = own;
    else if (staffScope(user).kind === 'none') throw forbidden('Staff member has no location');
  }

  async createModel(user: AdminUser, body: unknown): Promise<AdminModel> {
    const b = asBody(body);
    const d = this.modelData(staffScope(user).kind === 'all' ? b : { ...b, locationId: 'own' }, true);
    this.ownLocation(user, d);
    await this.assertRefs(d);
    const slug = `${slugify(String(d.name))}-${randomBytes(3).toString('hex')}`;
    const m = await this.prisma.bikeModel.create({ data: { ...(d as Prisma.BikeModelUncheckedCreateInput), slug, isDemo: false } });
    await writeAudit(this.prisma, actorOf(user), 'model.create', 'BikeModel', m.id, { name: m.name });
    return this.model(user, m.id);
  }

  /** Правка владельцем снимает «ДЕМО» с модели. */
  async updateModel(user: AdminUser, id: string, body: unknown): Promise<AdminModel> {
    const d = this.modelData(asBody(body), false);
    if (d.locationId !== undefined) this.ownLocation(user, d);
    await this.assertRefs(d);
    const before = await this.prisma.bikeModel.findFirst({ where: { id, ...this.scope(user) }, select: { deposit: true, isActive: true } });
    if (!before) throw notFound('Model not found');
    await this.prisma.bikeModel.update({ where: { id }, data: { ...d, isDemo: false } });
    await writeAudit(this.prisma, actorOf(user), 'model.update', 'BikeModel', id, { fields: Object.keys(d), ...(d.deposit !== undefined ? { deposit: { from: before.deposit, to: d.deposit } } : {}) });
    return this.model(user, id);
  }

  /** Добавить фото: конвертация в WebP/AVIF 400/800/1200 и запись в публичное хранилище. */
  async addPhoto(user: AdminUser, id: string, upload: RawUpload): Promise<AdminModel> {
    const m = await this.prisma.bikeModel.findFirst({ where: { id, ...this.scope(user) }, select: { slug: true, photos: true } });
    if (!m) throw notFound('Model not found');
    const photos = storedPhotos(m.photos);
    if (photos.length >= 8) throw badRequest('At most 8 photos per model');
    const img = await convertPhoto(upload.body);
    const key = `models/${m.slug}/${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
    const sizes = await storePhoto(key, img);
    photos.push({ key, sizes });
    await this.prisma.bikeModel.update({ where: { id }, data: { photos: photos as unknown as Prisma.InputJsonArray, isDemo: false } });
    await writeAudit(this.prisma, actorOf(user), 'model.photo.add', 'BikeModel', id, { key });
    return this.model(user, id);
  }

  /** Удалить фото / сделать главным (первым). */
  async updatePhotos(user: AdminUser, id: string, body: unknown): Promise<AdminModel> {
    const b = asBody(body);
    const m = await this.prisma.bikeModel.findFirst({ where: { id, ...this.scope(user) }, select: { photos: true } });
    if (!m) throw notFound('Model not found');
    const photos = storedPhotos(m.photos);
    const key = str(b.key, 'key', 300);
    const idx = photos.findIndex((p) => p.key === key);
    if (idx < 0) throw notFound('Photo not found');
    const action = oneOf(b.action, 'action', ['delete', 'main'] as const);
    const [photo] = photos.splice(idx, 1);
    if (action === 'main') photos.unshift(photo!);
    await this.prisma.bikeModel.update({ where: { id }, data: { photos: photos as unknown as Prisma.InputJsonArray, isDemo: false } });
    if (action === 'delete' && !photo!.demo) for (const s of Object.values(photo!.sizes)) for (const k of [s.webp, s.avif]) if (k) await deletePublic(k);
    await writeAudit(this.prisma, actorOf(user), `model.photo.${action}`, 'BikeModel', id, { key });
    return this.model(user, id);
  }

  // ---------- Байки ----------

  async bikes(user: AdminUser, q: Record<string, unknown>): Promise<AdminListOf<AdminBike>> {
    const where: Prisma.BikeWhereInput = { ...this.scope(user), ...(typeof q.modelId === 'string' && q.modelId ? { modelId: q.modelId } : {}) };
    const rows = await this.prisma.bike.findMany({ where, include: { model: { select: { name: true } } }, orderBy: [{ model: { name: 'asc' } }, { plate: 'asc' }] });
    return { items: rows.map((b) => toAdminBike(b, canSeeMoney(user.role))), total: rows.length };
  }

  private async visibleBike(user: AdminUser, id: string) {
    const bike = await this.prisma.bike.findFirst({ where: { id, ...this.scope(user) } });
    if (!bike) throw notFound('Bike not found');
    return bike;
  }

  private bikeData(b: Body, creating: boolean): Prisma.BikeUncheckedUpdateInput {
    const d: Prisma.BikeUncheckedUpdateInput = {};
    if (creating || has(b, 'modelId')) d.modelId = str(b.modelId, 'modelId');
    if (creating || has(b, 'plate')) d.plate = str(b.plate, 'plate', 20).toUpperCase();
    if (has(b, 'vin')) d.vin = optStr(b.vin, 'vin', 40)?.toUpperCase() ?? null;
    if (has(b, 'mileageKm')) d.mileageKm = int(b.mileageKm, 'mileageKm', 0, 2_000_000);
    if (has(b, 'status')) d.status = oneOf(b.status, 'status', BIKE_STATUSES);
    if (has(b, 'readyAt')) d.readyAt = optInstant(b.readyAt, 'readyAt');
    if (has(b, 'serviceDate')) d.serviceDate = optInstant(b.serviceDate, 'serviceDate');
    if (has(b, 'insuranceUntil')) d.insuranceUntil = optInstant(b.insuranceUntil, 'insuranceUntil');
    if (has(b, 'purchasePrice')) d.purchasePrice = optInt(b.purchasePrice, 'purchasePrice', 0, 2_000_000_000);
    if (d.status && d.status !== 'REPAIR' && !has(b, 'readyAt')) d.readyAt = null;
    return d;
  }

  private async saveBike(fn: () => Promise<Bike>): Promise<Bike> {
    try {
      return await fn();
    } catch (e) {
      if (isUniqueViolation(e, 'plate')) throw apiError(HttpStatus.CONFLICT, 'PLATE_TAKEN', 'Bike with this plate exists');
      if (isUniqueViolation(e, 'vin')) throw apiError(HttpStatus.CONFLICT, 'PLATE_TAKEN', 'Bike with this VIN exists');
      throw e;
    }
  }

  async createBike(user: AdminUser, body: unknown): Promise<AdminBike> {
    const d = this.bikeData(asBody(body), true);
    const model = await this.prisma.bikeModel.findFirst({ where: { id: String(d.modelId), ...this.scope(user) }, select: { locationId: true } });
    if (!model) throw badRequest('Unknown modelId');
    const bike = await this.saveBike(() => this.prisma.bike.create({ data: { ...(d as Prisma.BikeUncheckedCreateInput), locationId: model.locationId, isDemo: false } }));
    await writeAudit(this.prisma, actorOf(user), 'bike.create', 'Bike', bike.id, { plate: bike.plate });
    return this.bike(user, bike.id);
  }

  async bike(user: AdminUser, id: string): Promise<AdminBike> {
    const b = await this.prisma.bike.findFirst({ where: { id, ...this.scope(user) }, include: { model: { select: { name: true } } } });
    if (!b) throw notFound('Bike not found');
    return toAdminBike(b, canSeeMoney(user.role));
  }

  /** Менеджер (своя точка) — только status, readyAt, mileageKm, serviceDate; «ДЕМО» снимает только владелец. */
  async updateBike(user: AdminUser, id: string, body: unknown): Promise<AdminBike> {
    const b = asBody(body);
    const before = await this.visibleBike(user, id);
    if (user.role === 'MANAGER' && Object.keys(b).some((k) => b[k] !== undefined && !MANAGER_BIKE_FIELDS.has(k))) throw forbidden('Manager can change only status, readyAt, mileage and service date');
    const d = this.bikeData(b, false);
    if (d.status === 'REPAIR' || d.status === 'RETIRED') await assertBikeCanStop(this.prisma, id, d.status);
    if (typeof d.modelId === 'string') {
      const model = await this.prisma.bikeModel.findFirst({ where: { id: d.modelId, ...this.scope(user) }, select: { locationId: true } });
      if (!model) throw badRequest('Unknown modelId');
      d.locationId = model.locationId;
    }
    await this.saveBike(() => this.prisma.bike.update({ where: { id }, data: { ...d, ...(canSeeMoney(user.role) ? { isDemo: false } : {}) } }));
    await writeAudit(this.prisma, actorOf(user), 'bike.update', 'Bike', id, { fields: Object.keys(d), ...(d.status ? { status: { from: before.status, to: d.status } } : {}) });
    return this.bike(user, id);
  }

  private docField(kind: string): 'registrationDocKey' | 'insuranceDocKey' {
    const k = oneOf(kind, 'kind', ['registration', 'insurance'] as const satisfies readonly BikeDocKind[]);
    return k === 'registration' ? 'registrationDocKey' : 'insuranceDocKey';
  }

  /** Ссылка для загрузки документа байка в приватное хранилище; за байком он закрепится после docConfirm. */
  async docUpload(user: AdminUser, id: string, kind: string, body: unknown): Promise<BikeDocUpload> {
    this.docField(kind);
    const contentType = str(asBody(body).contentType, 'contentType', 100);
    if (!DOC_TYPES.has(contentType)) throw badRequest('contentType must be PDF or an image');
    const bike = await this.visibleBike(user, id);
    const key = `bikes/${bike.id}/${kind}-${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
    const put = await this.storage.presignPut(key, contentType);
    return { key, uploadUrl: put.url, headers: put.headers, expiresAt: put.expiresAt.toISOString() };
  }

  /** Файл загружен: теперь ключ закрепляется за байком и старый файл удаляется. Сорвавшаяся загрузка старый документ не теряет. */
  async docConfirm(user: AdminUser, id: string, kind: string, body: unknown): Promise<AdminBike> {
    const field = this.docField(kind);
    const key = str(asBody(body).key, 'key', 200);
    const bike = await this.visibleBike(user, id);
    if (!key.startsWith(`bikes/${bike.id}/${kind}-`)) throw badRequest('Unknown document key');
    await this.prisma.bike.update({ where: { id }, data: { [field]: key } });
    const old = bike[field];
    if (old && old !== key) await this.storage.delete(old).catch(() => undefined);
    await writeAudit(this.prisma, actorOf(user), 'bike.document.upload', 'Bike', id, { kind });
    return this.bike(user, id);
  }

  /** Просмотр документа байка по временной ссылке (≤ 600 с); выдача пишется в журнал. */
  async docUrl(user: AdminUser, id: string, kind: string): Promise<DocumentUrlResponse> {
    const field = this.docField(kind);
    const bike = await this.visibleBike(user, id);
    const key = bike[field];
    if (!key) throw notFound('Document not uploaded');
    const r = await this.storage.presignGet(key, DOC_TTL_SEC);
    await writeAudit(this.prisma, actorOf(user), 'bike.document.read', 'Bike', id, { kind });
    return { url: r.url, expiresAt: r.expiresAt.toISOString() };
  }
}
