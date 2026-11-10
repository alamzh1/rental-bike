# Архитектура

Монорепозиторий pnpm (Node ≥ 20.19, TypeScript strict). Имена в коде английские, тексты интерфейса только через `packages/i18n`.

## Модули

| Путь | Роль |
|---|---|
| `apps/miniapp` | Mini App: клиент и режим менеджера (`/manager/*`) |
| `apps/admin` | веб-админка (Refine headless, React, Vite) |
| `apps/api` | NestJS: REST под `/api`, Telegram-бот, очереди BullMQ |
| `packages/shared` | цена, правила дат, машина статусов, типы API; не знает о БД и HTTP |
| `packages/i18n` | словари ru/en/vi, i18next, форматтеры, `pickText` |
| `packages/ui` | Tailwind-пресет из `design-system`, общие React-компоненты |
| `design-system` | исходные токены и компоненты, только чтение |

## Поток данных

1. Mini App (`useApp().api.request`) идёт в `/api`: `POST /auth/telegram` (initData, в dev `{devUser}`) отдаёт JWT на 24 ч, дальше `Authorization: Bearer`. Каталог и `POST /quotes` доступны без сессии.
2. Каталог и доступность: `catalog`, `availability` и `pricing` читают БД; цену считает единственная функция `shared.quote`, её же вызывает клиент.
3. Бронь: `POST /bookings` -> `BookingsService.create` в транзакции, байк удерживается `holdMinutes`; гонку за последний байк решает exclusion constraint `bookings_bike_no_overlap` (23P01), клиент получает 409 `BIKE_TAKEN`.
4. Оплата: `POST /bookings/:id/pay` -> `PaymentProvider.createPayment` (QR VietQR, аренда + депозит одним платежом) -> webhook `POST /webhooks/payos` -> `PaymentsService.markPaid` (идемпотентно) -> статус CONFIRMED. В dev и тестах оплату имитирует `POST /dev/payments/:id/pay`.
5. События брони (`BookingEvents`) слушает `notifications`: бот шлёт сообщения через `Notifier`; `jobs` держит истечение удержания, напоминания, no-show, курсы.
6. Выдача и возврат: менеджер через `/manager/*` (акты, фото, наличные); клиент подтверждает выдачу `POST /bookings/:id/handover/:actId/confirm` (CONFIRMED -> ISSUED).
7. Админка ходит в `/admin/*` с cookie-сессией `admin_session`; изменяющие запросы несут заголовок `x-admin-request`; менеджеру открыт только список `ADMIN_API_MANAGER_SEGMENTS`.
8. OpenAPI генерируется из NestJS в `docs/openapi.json` (`pnpm openapi`).

## Границы

- Внешние сервисы только за адаптерами с подменой в dev: `PaymentProvider` (payOS | Test | Disabled), `Notifier` (Grammy | Log), `Storage` (S3 | Local), `RatesProvider`.
- Модули API общаются через фасады сервисов, а не через чужие таблицы; `manager` и `admin` только HTTP, наружу ничего не выставляют.
- `auth` глобальный: `JwtAuthGuard`, `OptionalJwtAuthGuard`, `RolesGuard` + `@Roles`, `AdminSessionGuard`, `@CurrentUser()`.
- Типы API лежат по файлу на модуль: `packages/shared/src/api/<module>.ts`.
- Mini App: экран = `src/features/<feature>/index.tsx` (default export, ленивый маршрут); админка: `src/features/<section>/index.tsx`.
- Приватные файлы отдаются по подписанным ссылкам (`presignGet` не дольше 600 с).

## Договорённости

- Деньги: целые VND. Время: UTC в API и БД, показ в `location.timezone` (по умолчанию `Asia/Ho_Chi_Minh`).
- Контент из БД: `I18nText = { ru?, en, vi? }`, выбор через `pickText(text, lang)`, фолбэк EN. Правки текстов из админки лежат в `I18nOverride` поверх JSON; `GET /i18n/{lang}` отдаёт объединённый словарь.
- Ключи i18n группируются по экрану (`home.*`, `catalog.*`, ...), набор ключей во всех трёх языках одинаков (проверяется в `pnpm check`).
- Ошибки API: `{ code, message }`, `code` машинный, текст переводит клиент.
- Правила бизнеса живут в таблице `Setting` (ключ -> JSON): удержание, буфер, отмена, опоздание, депозит и др.; грузятся через `loadSettings` (`apps/api/src/pricing/settings.ts`).
- Демо-данные помечены `isDemo: true` и плашкой «ДЕМО» в админке; факты о бизнесе не выдумываются.
- Отмена: процент возврата только к аренде, депозит возвращается полностью; возврат создаётся PENDING, закрывает его админ.
- Дизайн: перед версткой читать `DESIGN.md` и `design-system/README.md`; цвета только токенами, без литералов.
- Секреты только по имени из `.env`; все имена перечислены в `.env.example`.
