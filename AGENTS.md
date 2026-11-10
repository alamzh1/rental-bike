<!-- autopilot:start -->
# Аренда Байка

Telegram Mini App для аренды мотобайков в Куинён (Вьетнам): турист выбирает байк, даты и платит за 60 секунд, не выходя из Telegram.

## Команды

| Команда | Что делает |
|---------|------------|
| `pnpm install` | зависимости; postinstall собирает `packages/i18n`, `packages/shared` и генерирует Prisma-клиент |
| `pnpm infra` | docker compose: postgres, redis, backup; MinIO опционален |
| `pnpm db:migrate` | миграции Prisma (dev) |
| `pnpm db:seed` | сид: 6 моделей, 14 байков, тестовые пользователи вне production |
| `pnpm dev` | infra + сборка пакетов + все приложения: API :3000 (`/api/health`), Mini App :5173 (`?dev_user=client\|manager\|owner\|admin`), админка :5174 |
| `pnpm check` | сборка пакетов, typecheck, lint, unit, integration; 747 тестов |
| `pnpm exec playwright install chromium` | один раз перед первым `pnpm e2e` |
| `pnpm e2e` | Playwright, 5 тестов; свои порты 3100/5183 |
| `pnpm --filter @rental/api exec vitest run <путь>` | один тест-файл (для другого пакета — его имя из `package.json`) |
| `pnpm public:setup <домен>` | один раз: постоянный туннель Cloudflare, DNS, настройки `.env` |
| `pnpm public` | открыть приложение тестерам с этого Mac через туннель (`docs/deploy.md`) |
| `pnpm openapi` | перегенерировать `docs/openapi.json` |
| `pnpm load` | нагрузочный k6-прогон `load/booking-load.js` (нужен установленный k6) |

## Где что

- `apps/api/src/<модуль>/` — NestJS-модули; `app.module.ts` собирает все.
- `apps/api/prisma/` — `schema.prisma`, миграции (там же exclusion constraint броней), `seed.ts`.
- `apps/miniapp/src/features/<экран>/index.tsx` — экраны Mini App; `apps/admin/src/features/<раздел>/` — разделы админки.
- `packages/shared/src/` — цена, даты, статусы, типы API (`api/<модуль>.ts`); БД и HTTP не знает.
- `packages/i18n/locales/<lang>/<namespace>.json` — переводы, файл на пространство имён, все три языка сразу.
- `design-system/tokens.json` — источник токенов; `packages/ui/src/tokens.generated.css` генерируется (`packages/ui/scripts/gen-tokens.mjs`).
- `e2e/tests/`, `apps/api/test/` — e2e и тесты API; `docs/` — деплой, восстановление, гайды, `docs/adr/`.
- Архитектура и договорённости — `docs/architecture.md`.

## Подводные камни

- Порты dev: Postgres 5442, Redis 6389, MinIO 9010 (стандартные заняты). Значения по умолчанию — `scripts/env-defaults.mjs`; команды, которым нужны переменные, идут через `scripts/run-with-env.mjs`.
- Тестовый вход и тестовая оплата работают только при `NODE_ENV=development|test` (ставит `scripts/env-defaults.mjs`); запуск мимо него даёт 503 `PAYMENT_NOT_AVAILABLE` / 404 на `/dev/payments`.
- MinIO: официальный образ не скачивается; в dev файлы в `storage/` (LocalStorage). Без MinIO `pnpm infra` только предупреждает.
- Схему Prisma и миграции менять осторожно: exclusion constraint `bookings_bike_no_overlap` и триггер `blocked_until` живут в SQL миграции, а не в `schema.prisma`.
- `packages/shared` и `packages/i18n` API подключает из `dist`: после правок — `pnpm build:packages` (его делает `pnpm dev` и `pnpm check`).
- Размер первого экрана Mini App ограничен size-limit (250 КБ gzip); тяжёлые экраны — отдельными чанками, иначе unit-тест падает.
- Не трогать: `design-system/`, `ТЗ_*.docx`, `пример_*.jpg`, `PRODUCT.md`, служебные папки агентов в корне.
- Сид в production тестовых пользователей не создаёт.
- Роль и видимость сотрудника — только через `apps/api/src/auth/staff-scope.ts`: новый запрос к данным точки без `scopeWhere`/`inScope` покажет владельцу чужое. Суммы — `canSeeMoney` из `packages/shared`.

## Окружение

Имена из `.env.example` (скопировать в `.env`, значения не коммитить):

- `NODE_ENV`, `DEV_AUTH`, `API_PORT`, `API_HOST` — режим, тестовый вход (`1`; `local` — только вход в админку с этой машины), порт API, адрес (по умолчанию `127.0.0.1`; в контейнере — `0.0.0.0`).
- `API_DOCS` — `off` убирает `/api/docs` (ставит `pnpm public`).
- `IP_RATE_LIMIT` — `off` выключает общий лимит запросов с адреса (тесты; в работе не трогать).
- `TEST_PAY_TELEGRAM_IDS` — кому кроме сотрудников в `pnpm public` доступна тестовая оплата (через запятую).
- `MINIAPP_URL`, `ADMIN_URL`, `API_PUBLIC_URL` — публичные адреса (ссылки бота, CORS, Login Widget).
- `DATABASE_URL`, `DATABASE_URL_TEST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `BACKUP_RETENTION_DAYS` — PostgreSQL, тестовая БД, бэкапы.
- `REDIS_URL`, `REDIS_PORT`, `JOBS_DRIVER` — Redis и драйвер очередей (bullmq|memory).
- `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`, `S3_PUBLIC_URL`, `S3_SSE` — S3/MinIO.
- `STORAGE_DRIVER`, `STORAGE_DIR`, `FILES_SIGNING_SECRET` — локальное или S3-хранилище, подпись ссылок.
- `MINIO_IMAGE`, `MC_IMAGE`, `MINIO_PORT`, `MINIO_CONSOLE_PORT` — образы и порты MinIO.
- `JWT_SECRET`, `ADMIN_SESSION_SECRET`, `ADMIN_TELEGRAM_IDS` — токены, сессия админки, Telegram ID админов.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_ALERT_CHAT_ID` — бот (без токена сообщения идут в лог) и алерты.
- `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYOS_WEBHOOK_IPS`, `PAYOS_API_URL`, `TRUST_PROXY` — оплата payOS/VietQR (без ключей — тестовый провайдер), whitelist webhook, trust proxy.
- `PAYMENT_KEYS_SECRET` — шифрование ключей payOS точек в БД; менять нельзя, иначе ключи вводятся заново.
- `GPS_FORWARD_SECRET` — приём точек от Traccar Server (гайд — `docs/gps.md`).
- `SENTRY_DSN` — мониторинг.
- `E2E_API_PORT`, `E2E_MINIAPP_PORT`, `LOAD_BASE_URL`, `LOAD_BOT_TOKEN` — порты e2e и параметры нагрузочного прогона.

## Как здесь работает Autopilot

Сборка ведётся навыком `/autopilot`. Требования, спецификация и таски — в `.autopilot/`.
Прогресс — `.autopilot/dashboard.html`. Требование из `manifest.md` может снять
только пользователь. Прерванную сборку продолжает «продолжи автопилот».

### Правка без автопилота

Мелкий баг или доводка после сборки — обычная сессия, без прогона.

Сначала прочитай:
1. `.autopilot/PROGRESS.md` — что не доделано, известные баги, о чём договорились с пользователем.
2. Что правили после последней сборки — первая строка таблицы в «История git».
3. Только если правка их касается: почему сделано так — `docs/adr/`; что значат слова — `CONTEXT.md`;
   что именно просили — `manifest.md` в папке сборки (указана в начале `PROGRESS.md`).

После правки:
- коммит — по правилам из «История git»;
- строка в «Правки без автопилота» в `PROGRESS.md`: дата — что — почему;
- починенный пункт из «Не доделано» или «Известные баги» — удали;
- договорились с пользователем о том, что следующая сборка не должна пересматривать, —
  строка в «Договорились», его словами.

### История git

Целиком не читай — бери срез под вопрос:

| Вопрос | Команда |
|---|---|
| что правили после последней сборки | `git log --oneline "$(git log -1 --format=%h --grep='^Autopilot: сборка сдана')"..HEAD -- . ':(exclude).autopilot'` |
| всё, что делали ради требования | `git log --oneline --grep="R02"` |
| история файла | `git log --oneline -10 -- <файл>` |
| когда появился или исчез код | `git log --oneline -S "<фрагмент>"` |
| почему строка такая | `git blame -L <с>,<по> <файл>`, затем `git show <sha>` |
| что внутри коммита | `git show --stat <sha>` |

Срез длиннее ~30 коммитов — отдай его субагенту и возьми выжимку в десять строк.

Коммит: заголовок — что (`fix: даты в одном формате`), тело — почему, трейлер
`--trailer "Requirements: R02"`, если правка касается требования из `manifest.md`.
Заголовок `Autopilot: сборка сдана` пишет только автопилот — по нему находят последнюю сборку.
<!-- autopilot:end -->
