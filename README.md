# Аренда Байка

Telegram Mini App для аренды байков в Куинёне: клиент выбирает даты и байк, видит цену за весь срок, бронирует на одном экране и платит VietQR или наличными при получении — на русском, английском или вьетнамском. Бот подтверждает бронь и напоминает о выдаче и возврате. Менеджер выдаёт и принимает байк по QR с фотоактом в том же приложении. Владелец ведёт парк, цены, брони и шахматку в веб-админке.

Без аккаунтов бота и платёжного сервиса всё работает в тестовом режиме: оплата подтверждается тестовой кнопкой, сообщения бота пишутся в лог. Ключи в `.env` включают настоящие.

## Состав

| Папка | Что это |
|---|---|
| `apps/miniapp` | Mini App: клиент и режим менеджера (React, Vite, Tailwind) |
| `apps/admin` | Веб-админка (React, Refine headless, Vite) |
| `apps/api` | API на NestJS: REST, бот (grammY), очереди (BullMQ), Prisma + PostgreSQL 16 |
| `packages/shared` | Типы API, расчёт цены, правила дат, статусы брони |
| `packages/i18n` | Переводы RU/EN/VI, форматы цен и дат, [глоссарий](packages/i18n/glossary.md) |
| `packages/ui` | Общие компоненты и Tailwind-пресет из `design-system/` |
| `design-system/` | Дизайн-система (токены, компоненты); как она легла в код — [DESIGN.md](DESIGN.md) |
| `e2e/`, `load/` | Сквозные тесты Playwright и сценарий нагрузки k6 |
| `docs/` | Инструкции, OpenAPI, чек-лист приёмки |

## Быстрый старт

Нужны Node ≥ 20.19, pnpm 9 (`corepack enable`), Docker.

```bash
pnpm install          # зависимости + сборка packages + Prisma Client
pnpm db:migrate       # поднимите сначала инфраструктуру: pnpm infra
pnpm db:seed          # точка выдачи, демо-парк, настройки, тестовые пользователи
pnpm dev              # PostgreSQL/Redis в Docker + API + Mini App + админка
```

Порядок с нуля: `pnpm install` → `pnpm infra` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`.

| Что | Адрес в dev |
|---|---|
| Mini App | http://localhost:5173/?dev_user=client (или `manager`, `admin`; язык — `&lang=en`) |
| Админка | http://localhost:5174 (кнопка тестового входа) |
| API | http://localhost:3000/api/health, Swagger UI — http://localhost:3000/api/docs |

`.env` не обязателен: пустые переменные получают локальные значения из `scripts/env-defaults.mjs` (`NODE_ENV=development`, `DEV_AUTH=1`, порты Postgres 5442, Redis 6389). Файлы (фото, документы) в dev лежат в `storage/`; MinIO — по желанию (`MINIO_IMAGE`).

Демо-данные (модели, цены, депозиты, рейтинги) помечены «ДЕМО» и заменяются в админке. Что ещё нужно от владельца — [docs/acceptance.md](docs/acceptance.md#что-нужно-от-владельца).

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | Инфраструктура в Docker + все приложения в режиме разработки |
| `pnpm infra` | Только PostgreSQL, Redis, бэкап (и MinIO, если задан образ) |
| `pnpm db:migrate` / `pnpm db:seed` | Миграции Prisma / демо-данные (идемпотентно) |
| `pnpm build` | Сборка пакетов и приложений |
| `pnpm check` | Типы + линтер + unit + интеграционные тесты (PostgreSQL из compose) + лимит размера Mini App |
| `pnpm e2e` | Playwright: путь клиента до «Бронь подтверждена», экраны RU/EN/VI в обеих темах на 360 px, сверка OpenAPI |
| `pnpm load` | Сценарий k6: 500 пользователей, 50 броней в минуту (запуск вручную, нужен [k6](https://k6.io)) |
| `pnpm openapi` | Пересобрать `docs/openapi.json` из маршрутов API (`--build` — сначала собрать API) |
| `node docs/tools/vi-review.mjs` | Пересобрать список VI-строк на вычитку `docs/i18n-vi-review.md` |

## Переменные окружения

Полный список с комментариями — [.env.example](.env.example). Скопируйте в `.env`; значения не коммитятся.

| Группа | Переменные |
|---|---|
| Режим | `NODE_ENV`, `DEV_AUTH`, `API_PORT`, `OPENAPI_WRITE`, `MINIAPP_URL`, `ADMIN_URL`, `API_PUBLIC_URL` |
| PostgreSQL | `DATABASE_URL`, `DATABASE_URL_TEST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `BACKUP_RETENTION_DAYS` |
| Redis / очереди | `REDIS_URL`, `REDIS_PORT`, `JOBS_DRIVER` |
| Файлы | `STORAGE_DRIVER`, `STORAGE_DIR`, `FILES_SIGNING_SECRET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`, `S3_PUBLIC_URL`, `S3_SSE`, `MINIO_IMAGE`, `MC_IMAGE`, `MINIO_PORT`, `MINIO_CONSOLE_PORT` |
| Вход | `JWT_SECRET`, `ADMIN_SESSION_SECRET`, `ADMIN_TELEGRAM_IDS` |
| Бот | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_ALERT_CHAT_ID` |
| Оплата (payOS / VietQR) | `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYOS_WEBHOOK_IPS`, `PAYOS_API_URL` |
| Мониторинг | `SENTRY_DSN` |
| Только для e2e / нагрузки | `E2E_API_PORT`, `E2E_MINIAPP_PORT` (по умолчанию 3100 / 5183), `LOAD_BASE_URL`, `LOAD_BOT_TOKEN` |

Без `TELEGRAM_BOT_TOKEN` сообщения бота пишутся в лог; без трёх `PAYOS_*` в dev работает тестовая оплата, а вне dev оплата VietQR выключена (503 `PAYMENT_NOT_AVAILABLE`).

## Документация

- [Деплой, туннель для Telegram, обратный прокси](docs/deploy.md)
- [Бэкап и восстановление](docs/restore.md)
- [Инструкция администратора](docs/admin-guide.md)
- Инструкция менеджера: [RU](docs/manager-guide.ru.md) · [EN](docs/manager-guide.en.md) · [VI](docs/manager-guide.vi.md)
- [OpenAPI](docs/openapi.json) (в dev — Swagger UI на `/api/docs`)
- [Приёмка по §13.2 ТЗ](docs/acceptance.md) · [Аудит дизайна Mini App](docs/design-audit.md)
- [Глоссарий RU/EN/VI](packages/i18n/glossary.md) · [VI-строки на вычитку](docs/i18n-vi-review.md)
