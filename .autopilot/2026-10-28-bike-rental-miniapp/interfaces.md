# Границы и правила проекта

Читать первым. Имена — английские; тексты интерфейса — только через i18n.

## Правила проекта

- Монорепозиторий pnpm, Node 20+, TypeScript strict везде. Корневые команды: `pnpm install`, `pnpm dev` (compose + все приложения), `pnpm check` (typecheck + lint + unit + integration), `pnpm e2e`.
- Деньги — целые числа VND (`number`, без дробей). Время — UTC `Date`/ISO в API и БД; отображение — в `location.timezone` (по умолчанию `Asia/Ho_Chi_Minh`) через `date-fns-tz`.
- Ни одной строки интерфейса в коде компонентов, сообщений бота или PDF: только ключи `packages/i18n`. Контент из БД — тип `I18nText = { ru?: string; en: string; vi?: string }`, выбор через `pickText(text, lang)` (фолбэк EN).
- Факты о бизнесе не выдумываются: демо-значения помечены `isDemo: true` в БД и плашкой «ДЕМО» в админке.
- Секреты только по имени из `.env`; `.env.example` содержит все имена с пустыми значениями.
- Дизайн: перед любой работой над UI прочитать `DESIGN.md` (корень) и `design-system/README.md`; использовать токены `design-system/tokens.css` через Tailwind-тему из `packages/ui`. Никаких литеральных цветов.
- Внешние сервисы — только через адаптеры ниже; в dev всё работает без аккаунтов.

## Границы, решённые в спецификации

### Структура

```
apps/miniapp     Mini App (клиент + режим менеджера)
apps/admin       веб-админка (Refine headless + React + Vite)
apps/api         NestJS: REST API, бот, очереди
packages/shared  типы API, расчёт цены, правила дат, машина статусов
packages/i18n    ru.json / en.json / vi.json, инициализация i18next, форматтеры
packages/ui      Tailwind preset из design-system, общие React-компоненты (Button, Chip, Sheet, Badge, Skeleton, PriceText, Icon)
design-system    исходная дизайн-система (только чтение; tokens.css импортируется)
```

### packages/shared — владеет правилами, не знает о БД и HTTP

```ts
export type Lang = 'ru' | 'en' | 'vi';
export type Currency = 'VND' | 'RUB' | 'USD';
export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'ISSUED' | 'COMPLETED' | 'CANCELLED_BY_CLIENT' | 'CANCELLED_BY_SYSTEM' | 'PROBLEM';
export type PaymentMethod = 'VIETQR' | 'CASH';
export type Role = 'CLIENT' | 'MANAGER' | 'ADMIN';

// Цена: чистая функция, единственное место расчёта; API и клиент вызывают одну и ту же
export interface TariffBracket { minDays: number; maxDays: number | null; pricePerDay: number }
export interface SeasonRuleInput { from: string; to: string; coefficient: number } // даты YYYY-MM-DD в tz точки
export interface ExtraInput { id: string; price: number; per: 'DAY' | 'ONCE'; qty: number }
export interface QuoteInput { startAt: Date; endAt: Date; timezone: string; tariffs: TariffBracket[]; seasons: SeasonRuleInput[]; extras: ExtraInput[]; deposit: number }
export interface QuoteLine { kind: 'RENT' | 'EXTRA' | 'DEPOSIT'; refId?: string; days?: number; unitPrice: number; amount: number }
export interface Quote { days: number; pricePerDay: number; rent: number; extras: number; total: number; deposit: number; lines: QuoteLine[] }
export function rentalDays(startAt: Date, endAt: Date): number; // ceil(часы / 24), минимум 1
export function quote(input: QuoteInput): Quote;
export function lateFee(plannedEnd: Date, actualEnd: Date, rules: { graceMinutes: number; hourlyFee: number; extraDayAfterHours: number; dayPrice: number }): number;
export function refundPercent(startAt: Date, cancelledAt: Date, rules: { fullHours: number; halfHours: number; halfPercent: number }): number; // 100 / 50 / 0
export function canTransition(from: BookingStatus, to: BookingStatus): boolean;
export function bookingCode(seq: number): string; // BK-24117
```

### packages/i18n

```ts
export function initI18n(lang: Lang): i18n;          // i18next + ICU
export function detectLang(languageCode?: string): Lang; // ru,uk,be,kk→ru; vi→vi; иначе en
export function formatPrice(vnd: number, lang: Lang, display?: { currency: Currency; rate: number }): string; // «150 000 ₫ (≈ 530 ₽)»
export function formatDate(d: Date, lang: Lang, tz: string): string;  // 12.11.2026 / 12 Nov 2026 / 12/11/2026
export function formatTime(d: Date, lang: Lang, tz: string): string;  // 14:30 / 2:30 PM
export function pickText(t: I18nText, lang: Lang): string;
```
Ключи сгруппированы по экрану: `home.*`, `catalog.*`, `bike.*`, `checkout.*`, `payment.*`, `bookings.*`, `profile.*`, `manager.*`, `admin.*`, `bot.*`, `contract.*`, `errors.*`. Все три файла имеют одинаковый набор ключей (проверка в `pnpm check`).

### apps/api — модули и их фасады

| Модуль | Владеет | Выставляет другим модулям |
|---|---|---|
| `auth` | проверка initData → JWT, сессии админки, роли | `JwtAuthGuard`, `AdminSessionGuard`, `@CurrentUser()`, `RolesGuard(@Roles(...))` |
| `catalog` | модели, байки, точки, опции, баннер | `CatalogService.listModels(filter)`, `getModel(id)` |
| `availability` | занятость, буфер, ремонт | `AvailabilityService.freeBikeCount(modelId, from, to)`, `busyDates(modelId, month)`, `busyUntil(modelId, from)` |
| `pricing` | тарифы, сезоны → вызов `shared.quote` | `PricingService.quoteFor(modelId, from, to, extras)` |
| `bookings` | создание с удержанием, статусы, отмена | `BookingsService.create(...)` (транзакция, 409 `BIKE_TAKEN`), `transition(id, to, actor)`, `cancel(id, actor)` |
| `payments` | платежи, webhook, возвраты | интерфейс `PaymentProvider { createPayment(booking): Promise<{ externalId; qrPayload; deeplink?; expiresAt }>; verifyWebhook(req): WebhookEvent \| null }`; `PaymentsService.markPaid(externalId, amount)` идемпотентно |
| `notifications` | бот и рассылки | интерфейс `Notifier { send(telegramId: string, key: string, params: object, button?: { textKey: string; startapp: string }): Promise<void> }` — `GrammyNotifier` / `LogNotifier`; `NotificationsService.bookingEvent(bookingId, event)` |
| `jobs` | BullMQ-очереди | `JobsService.scheduleHoldExpiry(bookingId, at)`, `scheduleReminders(bookingId)`, `cancelForBooking(bookingId)` |
| `documents` | загрузка, хранилище, очистка | интерфейс `Storage { presignPut(key, type); presignGet(key, ttlSec ≤ 600); delete(key); publicUrl(key) }` — `S3Storage` |
| `manager` | выдача, возврат, фотоакт, наличные, ремонт | только HTTP |
| `admin` | CRUD, шахматка, дашборд, настройки, журнал | только HTTP |
| `contracts` | PDF договора | `ContractsService.render(bookingId, lang): Buffer` |
| `analytics` | события воронки | `AnalyticsService.track(userId, name, props)` |
| `rates` | курсы | интерфейс `RatesProvider { get(): Promise<Record<'RUB'\|'USD', number>> }` — из настроек |
| `audit` | журнал действий | `AuditService.log(actorId, action, entity, entityId, diff)` |

Конфигурируемые правила (таблица `Setting`, ключ → JSON): `holdMinutes=15`, `bufferMinutes=60`, `minLeadMinutes=60`, `minRentDays=1`, `cancel={fullHours:24, halfHours:2, halfPercent:50}`, `late={graceMinutes:60, hourlyFee, extraDayAfterHours:4}`, `depositMode='MONEY'|'DOCUMENT'`, `rates={RUB, USD}`, `docRetentionDays=90`, `contractTemplate: I18nText`, `rulesText`, `privacyText`, `managerContact`, `noShowHours=3`, `cashPrepayPercent=0`, `deliveryFee`, `faq: I18nText`, `defaultCurrencyByLang={ru:'RUB',en:'USD',vi:'VND'}`.

Таблица `I18nOverride (lang, key, value)` — правки текстов из админки поверх JSON; `GET /i18n/{lang}` отдаёт объединённый словарь.

`Location.ownerId` — арендодатель (задел под маркетплейс). `Document.verifiedBy/verifiedAt`. `Bike.registrationDocKey/insuranceDocKey`.

### HTTP API (префикс `/api`, JSON; ошибки `{ code, message }`, `code` — машинный, текст переводит клиент)

Mini App:
- `POST /auth/telegram` (initData) → `{ token, user, role }`; дальше `Authorization: Bearer <token>` (JWT 24 ч); `PATCH /me` (lang, currency, phone, licenseCategory, onboarded)
- `GET /models?from&to&category&type&cc&priceMin&priceMax&brand&options&sort` → `{ items: ModelCard[], count }`; `GET /models/count?…` → `{ count }`
- `GET /models/{id}?from&to` → `ModelDetail`; `GET /models/{id}/availability?month=YYYY-MM` → `{ busy: string[] }`
- `GET /home` → `{ location, banner, categories, popular }`; `GET /now` → модели, свободные на ближайшие 2 ч
- `POST /quotes` `{ modelId, startAt, endAt, extras }` → `Quote`
- `POST /bookings` `{ modelId, startAt, endAt, extras, paymentMethod, phone, agreed }` → `Booking` (статус PENDING_PAYMENT или CONFIRMED для наличных) · 409 `BIKE_TAKEN`
- `POST /bookings/{id}/pay` → `{ qrPayload, deeplink, amount, expiresAt }`; `GET /bookings`, `GET /bookings/{id}`; `POST /bookings/{id}/cancel` → `{ refundAmount }`; `POST /bookings/{id}/problem`; `POST /bookings/{id}/handover/{actId}/confirm`
- `GET /bookings/{id}/contract?lang` (PDF), `GET /bookings/{id}/calendar.ics`
- `POST /documents` → `{ uploadUrl, documentId }`; `GET /documents`
- `GET/POST/DELETE /favorites/{modelId}`; `POST /events`
- `POST /webhooks/payos`; dev: `POST /dev/payments/{id}/pay`
- менеджер (`@Roles('MANAGER','ADMIN')`): `GET /manager/today`, `GET /manager/bookings/{code}`, `POST /manager/bookings/{id}/handover`, `POST /manager/bookings/{id}/return`, `POST /manager/bookings/{id}/cash`, `PATCH /manager/bikes/{id}` (status, readyAt)
- админ (`/admin/*`, сессия): CRUD `models`, `bikes`, `tariffs`, `seasons`, `extras`, `locations`, `settings`, `banner`, `staff`; `GET /admin/dashboard`, `GET /admin/chess?from&to`, `PATCH /admin/bookings/{id}` (bikeId, status), `POST /admin/bookings` (ручная), `GET /admin/payments`, `POST /admin/payments/{id}/refund`, `GET /admin/audit`

Типы ответов — в `packages/shared/src/api.ts`; OpenAPI генерируется из NestJS (`@nestjs/swagger`) в `docs/openapi.json`.

### Тестовые швы

1. `shared.quote / lateFee / refundPercent / rentalDays / canTransition` — unit (vitest), покрытие ≥ 80%.
2. `BookingsService.create` на настоящем PostgreSQL (testcontainers или compose) — гонка двух броней последнего байка.
3. `PaymentProvider` / `Notifier` / `Storage` — подменяются `TestProvider` / `LogNotifier` / локальный MinIO.
4. e2e Playwright: Mini App в браузере с `DEV_AUTH=1` — путь открытие → оплата тестовым провайдером ≤ 60 с.

## Что построили закрытые таски

*(дописывается по мере сборки)*

## Как работать в репозитории (для исполнителей)

- Стек: Node 20+, pnpm 9 workspaces; React 18, Vite 5, TypeScript 5 strict; NestJS 10, Prisma 5, PostgreSQL 16 (+ `btree_gist`), Redis 7, BullMQ, grammY, MinIO; vitest; Playwright; Tailwind 3; i18next + i18next-icu; `@telegram-apps/sdk-react`; Refine (headless) для админки; pdfkit; Leaflet.
- Установка: `pnpm install`. Инфраструктура: `docker compose up -d` (postgres, redis, minio, backup). Миграции и сид: `pnpm db:migrate && pnpm db:seed`. Запуск всего: `pnpm dev`.
- **Одна проверка:** `pnpm check` — typecheck + lint + unit + integration (integration поднимает PostgreSQL из compose). Один файл: `pnpm vitest run <путь>` в пакете. e2e: `pnpm e2e`.
- **Чтобы параллельные таски не писали в одни файлы:**
  - Prisma-схема и все миграции — целиком в таске 01. Нужно изменить схему — `BLOCKED` с описанием, не правь сам.
  - `apps/api/src/app.module.ts` и пустые модули всех разделов создаёт таск 01; таски наполняют только свой каталог модуля.
  - Типы API — по файлу на модуль: `packages/shared/src/api/<module>.ts`; `packages/shared/src/api/index.ts` с реэкспортом всех файлов создаёт таск 01.
  - Переводы — по файлу на пространство имён: `packages/i18n/locales/<lang>/<namespace>.json`; таск пишет только свои пространства (`common` — таск 02). Все три языка сразу.
  - Роутер Mini App с ленивыми маршрутами на `apps/miniapp/src/features/<feature>/index.tsx` создаёт таск 02 (заглушки); таски наполняют свою папку `features/<feature>/`.
  - Общие UI-компоненты — только `packages/ui` (таск 02). Нужен новый общий — сделай локально в своей фиче.
- Не трогать: `design-system/` (только чтение), `ТЗ_*.docx`, `пример_*.jpg`, `PRODUCT.md`, служебные папки агентов в корне (`.windsurf`, `.grok`, `skills/` и т. п.).
- Дизайн: таск 02 через скилл impeccable пишет `DESIGN.md`; все остальные экранные таски читают `DESIGN.md` и `.claude/skills/impeccable/reference/craft-floor.md` перед вёрсткой.

### T01 (готово)
- shared: `rentalDays`, `quote` (+ `input.delivery`; `Quote.delivery`, `Quote.payable = total + deposit`; `total` без депозита; строка вида `DELIVERY`), `lateFee`, `refundPercent`, `canTransition`, `bookingCode` (BK- + 5 цифр, seq с 10001), `BOOKING_STATUSES`, `HOLDING_BOOKING_STATUSES`, `toLocationDate(d, tz)`, `fromLocationDateTime(date, time, tz)`, `I18nText`, `ApiError`, `HealthResponse`. Типы API — `packages/shared/src/api/*.ts` (файлы всех модулей уже созданы).
- i18n: `initI18n(lang, overrides?)`, `getDictionary(lang, overrides?)`, `detectLang`, `pickText`, `formatPrice/Date/Time` (неразрывные пробелы; `rate` — единиц валюты за 1 VND), `diffLocaleKeys`, `resources`; файл `locales/<lang>/<ns>.json` → ключи `<ns>.*`; ресурсы генерирует `packages/i18n/scripts/gen-resources.mjs`.
- БД: constraint `bookings_bike_no_overlap` (SQLSTATE 23P01) на `(bike_id, [start_at, blocked_until))` для PENDING_PAYMENT/CONFIRMED/ISSUED/PROBLEM; `blocked_until = end_at + buffer` триггером; `Booking.bikeId` обязателен.
- API: `GET /api/health`; `configureApp(app)` задаёт префикс `/api`. Порты dev: Postgres 5442, Redis 6389, MinIO 9010. Dev-значения переменных — `scripts/env-defaults.mjs`. Node ≥ 20.19 (shared/i18n — ESM, API подключает dist).
- Хранилище в dev — `LocalStorage` (D01), см. spec «Решения, доказанные сборкой».

### T03 (готово)
- `BikeModel.photos = [{ key: "models/<slug>/<view>", alt: I18nText, demo: true, sizes: { "400"|"800"|"1200": { webp, avif } } }]`, view ∈ `front34|side|rear34`; ключи без бакета/URL — URL строит API (`Storage.publicUrl`). В dev файлы лежат в `storage/public/models/...` (LocalStorage отдаёт `/files/public/<key>`).
- Скрипты: `node scripts/photos/generate.mjs [slug]`, `node scripts/photos/convert.mjs`; сид `uploadModelPhotos(slug, name)`.

### T04 (готово)
- `POST /auth/telegram {initData}|{devUser}` → `AuthResponse{token, expiresAt, user, role, startParam}`; `GET/PATCH /me` → `MeUser`.
- `GET /models`, `/models/count`, `/models/{id}`, `/models/{id}/availability?month`, `/home`, `/now`; `POST /quotes {modelId, startAt, endAt, extras?, delivery?}` → `Quote`. Каталог и quotes доступны без сессии (`OptionalJwtAuthGuard`).
- `GET /favorites`, `GET/POST/DELETE /favorites/{modelId}`; `POST /events` → 204; `GET /i18n/{lang}`.
- AuthModule глобальный: `JwtAuthGuard` (Bearer JWT или `tma <initData>`), `OptionalJwtAuthGuard`, `RolesGuard` + `@Roles`, `@CurrentUser(): AuthUser`, `AuthService.roleOf`; ошибки — `auth/api-errors` (`badRequest/notFound/unauthorized/forbidden`), коды VALIDATION, UNAUTHORIZED, NOT_FOUND, FORBIDDEN.
- `AvailabilityService.availabilityFor(ids, from, to)`, `freeBikeCount`, `busyUntil(modelId, from, to?)`, `busyDates(modelId, month)`; `PricingService.quoteFor(modelId, from, to, extras, {delivery})`, `rentQuotes`; `CatalogService.listModels/getModel/cardsByIds/nearestSlot`; `AnalyticsService.track(userId, name, props, source)`; `loadSettings(prisma, keys)` (apps/api/src/pricing/settings.ts).
- shared: `ModelCard`, `ModelDetail`, `ModelListQuery`, `HomeResponse`, `NowResponse`, `AvailabilityResponse`, `FavoritesResponse`, `MeUser`, `UpdateMeRequest`, `QuoteRequest`, `TrackEventRequest`; константы `MODEL_CATEGORIES`, `TRANSMISSIONS`, `CC_RANGES`, `MODEL_FEATURES`, `CATALOG_SORTS`, `ANALYTICS_EVENTS`.
- URL публичных файлов: `S3_PUBLIC_URL`, иначе `API_PUBLIC_URL/api/files/public` (catalog/public-url.ts). Проверка minLead — в BookingsService (T05).

### T02 (готово)
- `@rental/ui`: `Button`, `IconButton`, `Chip`, `ChipGroup`, `Badge`, `bookingStatusTone(status)`, `Skeleton`, `useDelayedFlag`, `PriceText`, `splitPrice(vnd, lang, display?)`, `Sheet`, `EmptyState`, `Icon`, `cn`; `@rental/ui/preset` (Tailwind), `@rental/ui/styles.css`. CSS-переменные токенов — `packages/ui/src/tokens.generated.css` (генерируются из `design-system/tokens.json`).
- Mini App: экран фичи — default export `src/features/<f>/index.tsx`; маршруты `/`, `dates/*`, `catalog/*`, `bikes/:modelId/*`, `favorites/*`, `checkout/:modelId/*`, `payment/:bookingId/*`, `bookings/*`, `profile/documents/*`, `profile/*`, `manager/*` (MANAGER/ADMIN); `paths` в `app/router.tsx`.
- `useApp()` → `{ platform, api.request<T>(path, {method, json}), token, user, role, mocked, updateMe(MePatch), setLang }`; `useHaptic()`; `<MainAction text onClick disabled loading />` (Telegram MainButton или своя кнопка); startapp `booking_<id>` / `model_<id>` / `manager`.
- Dev в браузере: `?dev_user=client|manager|admin`, `?lang=`. **Расхождение с T04:** оболочка шлёт неподписанный initData с `hash=dev`, а API принимает `{devUser}` — свести в `app/session/` (и заменить локальные типы `app/session/types.ts` на `packages/shared/src/api/auth.ts`).
- `DESIGN.md` в корне — читать перед любой вёрсткой. size-limit: первый экран 134 КБ gzip из 250; фичи — отдельные чанки (иначе проверка падает).

### T05 (готово)
- `BookingsService.create(userId, lang, input)`, `transition(id, to, actor)`, `transitionInTx`, `cancel(id, actor, reason)` → `{ refundAmount, refundPercent }`, `markNoShow`, `expireHold`, `expireOverdueHolds`, `cancelNoShows`.
- `BookingEvents.subscribe(fn)` — события `created, confirmed, payment_mismatch, payment_after_cancel, cancelled, expired, no_show, problem, refund_recorded, refunded` (на них подписывается notifications, T06).
- `RateLimiter.hit(bucket, userId)`; `PaymentsService.markPaid(externalId, amount)` (идемпотентно), `recordRefund`, `completeRefund`; токен `PAYMENT_PROVIDER`: `PaymentProvider { createPayment(PaymentRequest), verifyWebhook(req) }`.
- `JobsService.scheduleHoldExpiry`, `scheduleReminders(bookingId, startAt?)`, `cancelForBooking`, `register`, `every`; задача `JOB_REMINDER='booking.reminder'` с `{ bookingId, kind: '24h'|'2h' }` — обработчик пишет T06. `Clock.now()` (подменяется в тестах).
- `STORAGE`: `Storage { presignPut, presignGet (≤600 с), delete, publicUrl }`; `DocumentsService.signedUrl / verify / cleanup`.
- HTTP: `POST/GET /bookings`, `GET /bookings/:id` (+ `cancelPreview`), `POST /bookings/:id/{cancel,problem,pay}`, `GET /bookings/:id/calendar.ics`, `POST /webhooks/payos`, `POST /dev/payments/:id/pay { amount? }`, `POST/GET /documents`, `GET/DELETE /documents/:id`, `GET /documents/:id/url` (MANAGER/ADMIN), `GET /files/public/*`, `PUT|GET /files/private?key&exp&sig`. Типы — shared: `Booking`, `PayBookingResponse`, `CreateDocumentResponse` и др.
- Коды ошибок без переводов (добавляет T08 в `errors.json`): MIN_RENT_DAYS, LEAD_TIME, AGREEMENT_REQUIRED, PHONE_REQUIRED, HOLD_EXPIRED, PAYMENT_NOT_AVAILABLE, PAYMENT_PROVIDER_ERROR, INVALID_SIGNATURE, CONSENT_REQUIRED, FILE_TOO_LARGE, BIKE_TAKEN.
- Деньги: VietQR одним QR — аренда + депозит; при отмене процент только к аренде, депозит полностью; возврат создаётся PENDING, админ закрывает `completeRefund` (T11).

### T07 (готово)
- `useDates()` из `features/dates/store` → `{ range: {from, to} | null (ISO UTC), setRange, link(path, extra?) }`; даты в URL `?from&to` и в sessionStorage (`getStoredRange/setStoredRange`).
- Пути: `/dates?model=<id>`, `/catalog?<ModelListQuery>&sheet=filters`, `/bikes/:id`, переход в оформление — `/checkout/:id?from&to`.
- Чистые функции `dates/slots.ts`: `earliestSlot, quickRange, timeSlots, monthGrid, pickDay, composeRange`; `catalog/filters.ts`: `parseFilters, toParams, activeCount`; `catalog/api.ts`: `useModels, useModelCount, useHome, useModel, useFavorites, useFavorite, useTrack`.
- Сессия: dev шлёт `{devUser}`; `user.onboarded` (не `onboardedAt`).
- T05 ремонт: `PaymentProviderName = 'payos' | 'test' | 'disabled'`; `testProviderAllowed(env?)` — только NODE_ENV=development|test; без PAYOS_* вне dev — `DisabledProvider`: `POST /bookings/:id/pay` → 503 `PAYMENT_NOT_AVAILABLE`, webhook → 400; `/dev/payments` вне dev → 404. e2e и любые запуски должны идти через `scripts/env-defaults.mjs` (NODE_ENV=development).

### T06 (готово)
- `Notifier.send(telegramId, key, params{lang?,…}, button?{textKey, startapp})`, токен `NOTIFIER`; `LogNotifier.sent[]` (тесты); `renderBotText(key, params)`; `AlertService.alert(text)`.
- `NotificationsService.bookingEvent(id, {name, params})`, `runTomorrowSummary()`; задачи `booking.return-reminder`, `booking.overdue`, `notify.tomorrow-summary`, обработчик `JOB_REMINDER`.
- `ContractsService.render(bookingId, lang): Promise<Buffer>`; `GET /api/bookings/:id/contract?lang=` (JWT, только своя бронь).
- `RatesProvider.get()` (токен `RATES_PROVIDER`), `RatesService.info()/refresh()`; задача `rates.refresh` раз в сутки; **`GET /api/rates` → `RatesResponse { RUB, USD, updatedAt | null }`** (единиц валюты за 1 VND, без авторизации) — использовать для «≈ ₽/$».
- `POST /api/telegram/webhook` (заголовок `TELEGRAM_WEBHOOK_SECRET`). Интеграционные тесты могут брать отдельную БД через `DATABASE_URL_TEST`.

### T09 (готово)
- `/manager/*` (MANAGER/ADMIN): `GET today`, `GET bikes`, `GET bookings/:code|id`, `POST bookings/:id/{photos,handover,return,cash,no-show}`, `PATCH bikes/:id`, `POST documents/:id/verify`.
- Клиенту-владельцу: `GET /bookings/:id/handover` (акты, удержания, фото ≤10 мин, `depositRefund`), `POST /bookings/:id/handover/:actId/confirm` → `Booking` (CONFIRMED→ISSUED).
- shared `api/manager.ts`: `ManagerTodayResponse`, `ManagerBookingCard/Detail`, `HandoverRequest/Response`, `ReturnRequest/Response`, `CashRequest/Response`, `BikePatchRequest`, `ClientHandoverResponse`, `HANDOVER_PHOTOS_MIN/MAX`, `MANAGER_ERROR_CODES`. Опоздание — Payment SURCHARGE/CASH PENDING, закрывается `/cash` с `kind=SURCHARGE`.

### T10 (готово)
- Вход: `GET /admin/auth/config`, `POST /admin/auth/telegram` (поля Login Widget) | `POST /admin/auth/dev {role}` (только dev/test) → `AdminSessionResponse` + cookie `admin_session` (httpOnly, SameSite=Lax, Path=/api, 12 ч); `GET /admin/auth/me`; `POST /admin/auth/logout`.
- `GET /admin/dashboard`, `GET /admin/bookings?…`, `GET/PATCH /admin/bookings/:id`, `POST /admin/bookings` (ручная), `GET /admin/bookings/:id/documents/:docId/url`, `GET /admin/bookings/:id/acts/:actId/photos`, `GET /admin/chess?from&to`, `GET /admin/audit` (ADMIN); 409 → `AdminConflictError {code: BIKE_TAKEN|BIKE_UNAVAILABLE|BIKE_MODEL_MISMATCH|BOOKING_CLOSED}`.
- Для T11: `AdminSessionGuard`, `AdminUser`, `displayName` (apps/api/src/admin/auth); `AdminAccessMiddleware` на `admin/*`; shared `canOpenSection(role, section)`, `canCallAdminApi(role, segment)`, `ADMIN_API_MANAGER_SEGMENTS` (менеджеру закрыто всё вне списка), `ADMIN_REQUEST_HEADER='x-admin-request'` (обязателен на изменениях).
- Фронт: экран раздела — default export `apps/admin/src/features/<section>/index.tsx` (заглушки fleet, prices, locations, texts, payments, settings, banner); `useMe/useFormat/useErrorText/useToast`, `Panel/Field/DataTable` в `app/ui.tsx`; Refine dataProvider читает списки из `meta.query` → `{items, total}`.

### T11 (готово)
- `/admin/models` (+ фото: `POST :id/photos`, `PATCH :id/photos {key, action}`), `/admin/bikes` (+ документы `:id/documents/:kind`), `/admin/brands` (+ логотип), `GET /admin/tariffs`, `PATCH /admin/tariffs/:modelId`, `/admin/seasons`, `/admin/extras`, `/admin/locations` (+ менеджеры), `GET/PATCH /admin/texts`, `GET /admin/payments`, `/admin/payments/reconciliation`, `/admin/payments/deductions`, `POST /admin/payments/:id/refund`, `GET/PATCH /admin/settings`, `GET/PATCH /admin/banner` (+ изображение). Изменения — PATCH (не PUT).
- **`GET /settings/public` → `PublicSettings`** (без сессии) — для Mini App.
- `CreateBookingInput.staffWalkIn?: boolean` — только админка; клиентский путь не ставит.
- Коды ошибок: REFUND_DUPLICATE, REFUND_EXCEEDS_PAID, TARIFFS_INVALID, PLATE_TAKEN, IMAGE_INVALID, UNKNOWN_KEY. Типы — shared `api/admin-fleet.ts`.
