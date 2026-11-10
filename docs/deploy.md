# Деплой

Сборка ничего не публикует сама: сервер, домен, бот и аккаунт payOS заводит владелец. Ниже — порядок действий.

## 1. Что нужно заранее

| Что | Где взять | Куда вписать |
|---|---|---|
| Сервер Linux (по ТЗ — Сингапур или Вьетнам), Docker, Node ≥ 20.19, pnpm 9 | хостинг | — |
| Домен(ы) с HTTPS: Mini App и админка (Telegram открывает Mini App только по HTTPS) | регистратор + Let's Encrypt | `MINIAPP_URL`, `ADMIN_URL`, `API_PUBLIC_URL` |
| Бот: токен и имя | @BotFather → `/newbot` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` |
| Секрет webhook бота (случайная строка `A-Za-z0-9_-`, до 256 символов) | `openssl rand -hex 32` | `TELEGRAM_WEBHOOK_SECRET` |
| Аккаунт payOS (VietQR) | payOS → канал оплаты. Свой счёт точки: админка → «Точки» → «Онлайн-оплата»; `.env` — общий счёт для точек без своих ключей | `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PAYMENT_KEYS_SECRET` (шифрует ключи точек, менять нельзя) |
| Telegram ID администраторов (числа) | например, @userinfobot | `ADMIN_TELEGRAM_IDS` (через запятую) |
| Секреты сессий и подписи файлов (каждый — своя случайная строка) | `openssl rand -hex 32` | `JWT_SECRET`, `ADMIN_SESSION_SECRET`, `FILES_SIGNING_SECRET` |
| По желанию: чат алертов, Sentry, S3 | — | `ADMIN_ALERT_CHAT_ID`, `SENTRY_DSN`, `S3_*` |

Значения секретов храните только в `.env` на сервере (права `600`) или в менеджере секретов. В репозиторий — никогда.

## 2. Переменные для production

Скопируйте `.env.example` в `.env` и заполните. Обязательно:

- `NODE_ENV=production`, `DEV_AUTH` — пусто (тестовые пользователи и `/api/dev/*` выключены).
- `DATABASE_URL`, `REDIS_URL` — свои адреса; `POSTGRES_*` — для контейнера БД и бэкапа.
- `MINIAPP_URL`, `ADMIN_URL`, `API_PUBLIC_URL` — публичные HTTPS-адреса без `/` в конце.
- Все секреты из таблицы выше. Без `PAYOS_*` оплата VietQR вне dev выключена: клиент увидит «оплата недоступна», бронь наличными работает.
- Файлы: `STORAGE_DRIVER=local` + `STORAGE_DIR` (папка на диске, в бэкап) или `STORAGE_DRIVER=s3` + `S3_*` (приватный бакет с шифрованием, `S3_SSE`).

## 3. Сборка и запуск

```bash
pnpm install --frozen-lockfile
docker compose up -d postgres redis backup     # БД, очереди, ежедневный бэкап
pnpm --filter @rental/api db:deploy             # миграции (без сида!)
pnpm db:seed                                    # только при первом запуске: точка, настройки, демо-парк
# Фронтенды собираются с относительным /api (см. «Обратный прокси»):
API_PUBLIC_URL= pnpm --filter @rental/miniapp build   # → apps/miniapp/dist
API_PUBLIC_URL= pnpm --filter @rental/admin build     # → apps/admin/dist
pnpm --filter @rental/api build                       # → apps/api/dist
```

API запускается `node apps/api/dist/main.js` (рабочая папка — `apps/api`) с переменными из `.env`, например через systemd:

```ini
[Service]
WorkingDirectory=/srv/rental-bike/apps/api
EnvironmentFile=/srv/rental-bike/.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
```

В production бот сам ставит webhook на `API_PUBLIC_URL/api/telegram/webhook` с `TELEGRAM_WEBHOOK_SECRET`; без этих двух переменных — long polling (подходит для одного инстанса).

Сид создаёт точку, настройки и демо-модели с пометкой «ДЕМО». Тестовых пользователей (Telegram ID `100000001–100000003`) он создаёт только при `NODE_ENV=development` или `test`; при `NODE_ENV=production` их нет, а вход тестовым пользователем закрыт при любом `NODE_ENV`, кроме `development` и `test`. Если база когда-то засевалась в dev-режиме, удалите этих пользователей в БД до запуска. Замените демо-парк в админке до запуска.

## 4. Обратный прокси, HTTPS и `trust proxy`

Рекомендуемая схема — один прокси (nginx/Caddy) с HTTPS:

- `MINIAPP_URL` → статика `apps/miniapp/dist` + `location /api/ → http://127.0.0.1:3000`;
- `ADMIN_URL` → статика `apps/admin/dist` + тот же `location /api/`.

Админка держит сессию в cookie `admin_session` (`SameSite=Lax`, `Path=/api`), поэтому её `/api` должен быть того же происхождения, что и сама админка — отсюда сборка фронтендов с пустым `API_PUBLIC_URL`. Для SPA нужен фолбэк `try_files $uri /index.html`. `API_PUBLIC_URL` для API указывает на адрес, по которому снаружи доступен `/api` (ссылки на фото, webhook бота, возврат из payOS).

Пример nginx для Mini App:

```nginx
server {
  server_name app.example.com;           # ваш MINIAPP_URL
  root /srv/rental-bike/apps/miniapp/dist;
  location / { try_files $uri /index.html; }
  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20m;            # фото актов и документы
  }
}
```

**`trust proxy`.** API включает Express `trust proxy` из `TRUST_PROXY` (по умолчанию `loopback`): за прокси на той же машине `req.ip` — адрес клиента из `X-Forwarded-For`, и `PAYOS_WEBHOOK_IPS` сравнивается с настоящим адресом payOS. Если прокси стоит на другой машине, впишите в `TRUST_PROXY` его адрес или подсеть (или число прокси перед API); иначе API увидит адрес прокси и при заданном `PAYOS_WEBHOOK_IPS` отклонит каждый webhook. Прокси должен дополнять `X-Forwarded-For` (`$proxy_add_x_forwarded_for`). `X-Forwarded-For` от недоверенного адреса API игнорирует, поэтому не ставьте `TRUST_PROXY=true` — тогда адрес можно подделать заголовком. Дополнительно IP можно ограничить на самом прокси:

```nginx
location = /api/webhooks/payos {
  allow 203.0.113.10;                    # IP-адреса из кабинета payOS
  deny all;
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Подпись webhook payOS проверяется в любом случае (`PAYOS_CHECKSUM_KEY`).

## 5. Бот и Mini App в Telegram

1. @BotFather → `/mybots` → бот → **Bot Settings → Menu Button** → URL = `MINIAPP_URL`, текст кнопки, например «Арендовать байк».
2. Там же **Configure Mini App** (или `/newapp`) — ссылка вида `t.me/<bot>/app` для рекламы и QR.
3. Для входа в админку через Telegram Login Widget: @BotFather → `/setdomain` → домен `ADMIN_URL`.
4. Бот отвечает на `/start` кнопкой, открывающей Mini App; ссылки из уведомлений открывают нужную бронь (`startapp=booking_<id>`).

## Админка внутри Telegram

Сотруднику (`ADMIN_TELEGRAM_IDS` или роль в БД) бот ставит личную кнопку меню «Админка» при старте API и на `/start`; На `/start` и `/admin` бот присылает и закрепляет сообщение с кнопками «Войти как администратор» и «Войти как клиент»; те же кнопки приходят в ответ на любое сообщение сотрудника. Вход без формы, по подписи Telegram (`POST /api/admin/auth/webapp`). Остальные пользователи видят обычную кнопку бота. Нужен `ADMIN_URL` с `https://`. Новый сотрудник получает кнопку после `/start` в боте; у снятого она сбрасывается при следующем `/start`, а вход закрывается сразу.

## 6. Проверка после деплоя

- `GET https://<API>/api/health` → `{"status":"ok"}`.
- Swagger UI в production не публикуется; спецификация — [openapi.json](openapi.json).
- Откройте бота → «Арендовать байк» → пройдите бронь наличными (не требует оплаты), отмените её.
- Админка: вход через Telegram, раздел «Сводка» открывается, в «Брони» видна тестовая бронь.
- Первую оплату VietQR проверьте на минимальной сумме и сделайте возврат из раздела «Платежи».

## Постоянный туннель: тестирование с Mac

Подходит для короткого теста с несколькими людьми: сервер не нужен, адрес не меняется, но всё работает, только пока Mac включён. Домен должен быть подключён к Cloudflare (его DNS переходит туда, поэтому перед переносом проверьте, что записи других сервисов домена перенеслись).

```bash
brew install cloudflared      # один раз
pnpm public:setup example.com # один раз: вход в Cloudflare, туннель, DNS app. и admin., настройки .env
pnpm public                   # сборка и запуск; Ctrl+C останавливает всё
```

`public:setup` создаёт записи `app.` и `admin.`, ставит `DEV_AUTH=local` и генерирует недостающие секреты, не печатая их; существующие DNS-записи не заменяет. Затем в @BotFather: Menu Button → `https://app.example.com`, `/setdomain` → `admin.example.com`.

На сервере за nginx задайте заголовки страниц сами: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` и CSP (образец — `pageCsp` в `scripts/public-env.mjs`). `pnpm public` ставит их сам.

`pnpm public` не запустится с `DEV_AUTH=1` или стандартными секретами. Он отдаёт собранные фронтенды (порты 4173 и 4174), `/api/docs` наружу закрыт, оплата тестовая. `pnpm dev` с тем же токеном запускать одновременно нельзя: бот работает через long polling, и два экземпляра мешают друг другу. После этого `API_PUBLIC_URL` в `.env` указывает на туннель: при обычной разработке верните локальный адрес, иначе фото не загрузятся без запущенного туннеля.

## Туннель для проверки в Telegram без сервера

Telegram открывает Mini App только по HTTPS. Для проверки на телефоне с локальной машины:

1. Создайте **отдельного тестового бота** (не боевого) и впишите его `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` в локальный `.env`; поставьте `DEV_AUTH=0`: туннель публичный, а тестовый вход пускает любого по `?dev_user=admin`. Внутри Telegram вход идёт по подписанному initData.
2. Запустите `pnpm dev` и туннель на порт Mini App, например `cloudflared tunnel --url http://localhost:5173` (или `ngrok http 5173`). Туннель выдаст адрес `https://<что-то>.trycloudflare.com`.
3. Впишите адрес туннеля в `MINIAPP_URL` и `API_PUBLIC_URL` (`.env`) и в Menu Button тестового бота. Перезапустите `pnpm dev` — API и Vite читают `.env` при старте; Vite пускает только хост из `MINIAPP_URL`, а `API_PUBLIC_URL` нужен, чтобы фото байков грузились на телефоне.
4. API и бот работают локально: бот в dev — long polling, webhook не нужен; запросы Mini App к `/api` идут через прокси Vite.
5. Оплата в dev — тестовым провайдером (кнопка «Тест: оплатить за клиента»), у точки со своими ключами — настоящий payOS. Настоящий payOS через временный туннель не подключайте: его webhook должен попадать на постоянный адрес.

Туннель публикует ваш локальный сервер в интернет — выключайте его после проверки.
