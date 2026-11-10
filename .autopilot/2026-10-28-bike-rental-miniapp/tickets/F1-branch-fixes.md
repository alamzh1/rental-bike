# F1 — Исправления по код-ревью ветки

**Требования:** R47, R44, R46, R56i, R24, R34, R13, R14, R49, R40, R39
**Зависит от:** —
**Зона:** `apps/api/prisma/seed.ts` · `apps/api/src/auth/` · `apps/api/src/main.ts` · `apps/api/src/payments/payments.service.ts` · `apps/api/src/jobs/` · `apps/api/src/documents/documents.service.ts` · `apps/api/src/manager/manager.service.ts` · `apps/api/src/admin/{bookings,fleet,chess,dashboard}/` · общий хелпер области видимости менеджера (новый файл в `apps/api/src/auth/`) · `apps/api/package.json` · `docker-compose.yml` · `apps/admin/vite.config.ts` · `apps/miniapp/vite.config.ts` · `e2e/serve-api.mjs` · `docs/deploy.md` · `apps/miniapp/src/features/{bookings,catalog,bike,checkout,manager,payment}/` · `apps/miniapp/src/app/screens/` · `apps/miniapp/test/` · `packages/i18n/locales/*/{bookings,errors}.json` · `package.json` · `pnpm-lock.yaml` · тесты в `apps/api/test/`
**Волна:** 7
**Ревью:** да — ремонт ветки
**Модель:** сильная

## Что должно заработать

Закрыты дыры безопасности и расхождения со спецификацией, найденные код-ревью всей ветки: тестовые пользователи и тестовый вход не попадают в production, менеджер без точки ничего не видит, база и dev-серверы не открыты наружу, оплата подтверждается за прокси, сбои оплаты и задач доходят до администратора, вкладки броней и пересчёт цены соответствуют спецификации.

## Из брифа, дословно

> «Клиент не может получить доступ к чужой брони или документу (проверено подменой ID)»
> «Документы хранятся в приватном бакете, доступ — только по временным ссылкам (до 10 минут) и только для менеджера точки и администратора»
> «Вкладки: Активные, Предстоящие, Завершённые»
> «при выборе другой валюты отображения показывается пересчёт по курсу, обновляемому раз в сутки, с пометкой «≈»»

## Разделы спецификации

Истории 30, 39, 52–54, 62, 72, 84, 86, 87; interfaces.md целиком.

## Критерии приёмки

- [ ] seed.ts: при NODE_ENV=production сид не создаёт тестовых пользователей (или им даёт telegramId, невозможный в Telegram, например `dev:admin`), и docs/deploy.md пишет об этом правду
- [ ] docker-compose.yml: порты Postgres, Redis и MinIO привязаны к `127.0.0.1:`
- [ ] apps/admin/vite.config.ts и apps/miniapp/vite.config.ts: dev-серверы слушают только localhost (нет `host: true`)
- [ ] e2e/serve-api.mjs: `pnpm e2e` перед запуском всегда собирает API
- [ ] `sharp` есть в dependencies apps/api
- [ ] auth.service.ts: вход тестовым пользователем открыт только при NODE_ENV=development|test (как adminDevAuthEnabled); devUser принимается только из списка client|manager|admin, иначе 400 — тест на пустой NODE_ENV
- [ ] MANAGER без точки получает 403 или пустой результат, а не данные всех точек, во всех 7 местах (documents.service.ts:105, manager.service.ts:93-97, admin-bookings.service.ts:119 и :264, fleet.service.ts:122, chess.service.ts:27, dashboard.service.ts:33) — одной общей функцией; тест: менеджер без точки и менеджер точки A → 404 на бронь и документ точки B (админка и /documents/:id/url)
- [ ] main.ts: Express с `trust proxy` (из env, по умолчанию 'loopback'), req.ip — адрес клиента из X-Forwarded-For; тест или проверка webhook-ip за прокси
- [ ] Сбой createPayment (PAYMENT_PROVIDER_ERROR) и сбой любой задачи JobsService вызывают AlertService.alert
- [ ] Мои брони: вкладки «Активные» (ISSUED, PROBLEM), «Предстоящие» (CONFIRMED, PENDING_PAYMENT), «Завершённые» (COMPLETED и отменённые); ключи bookings.tabs.* и empty.* на трёх языках
- [ ] Каталог, карточка модели, шторка фильтров и MainButton: при валюте профиля RUB/USD и известном курсе каждая цена показывает «≈», как PriceText в оформлении
- [ ] Один errorKey(code), собранный из констант кодов ошибок @rental/shared, вместо трёх ручных списков (checkout/errors.ts, manager/logic.ts, ErrorScreen.tsx, Onboarding.tsx); тест: у каждого кода из shared есть перевод errors.* или manager.error.* во всех трёх языках
- [ ] Тест QR сверяет матрицу payment/qr.ts для реальной строки VietQR (~200 байт, версия ≥ 8) с эталоном (qrcode или jsQR в devDependencies) и декодирует исходную строку
- [ ] Оформление: если quote отвечает MIN_RENT_DAYS или LEAD_TIME, действие ведёт к выбору дат (link(paths.dates, {model})), а не к «Повторить»
