# 01 — Каркас, схема данных и правила расчёта

**Требования:** R42, R43, R28, R29, R30, R49, R54i, R56i, R37
**Зависит от:** —
**Зона:** корень (`package.json`, `pnpm-workspace.yaml`, `docker-compose.yml`, `.env.example`, конфиги lint/ts) · `apps/api/` (каркас, `prisma/`, `app.module.ts`, пустые модули) · `packages/shared/` · `packages/i18n/` (каркас, `formatters`) · `scripts/`
**Волна:** 1
**Ревью:** да — фундамент
**Модель:** сильная

## Что должно заработать

Репозиторий поднимается одной командой: PostgreSQL, Redis, MinIO и сервис ежедневного бэкапа в Docker Compose, NestJS-API стартует с пустыми модулями всех разделов из `interfaces.md`, Prisma-схема покрывает всю модель данных §10.2 (+ Setting, AuditLog, AnalyticsEvent, I18nOverride, Favorite, `Location.ownerId`), миграция добавляет exclusion constraint на интервалы броней байка с буфером, сид создаёт точку «4c Nguyễn Huệ, Quy Nhơn», 6 демо-моделей (`isDemo`) с тарифами, байками, опциями, настройками и тремя тестовыми пользователями (клиент, менеджер, админ). В `packages/shared` — все правила из `interfaces.md` (`quote`, `rentalDays`, `lateFee`, `refundPercent`, `canTransition`, `bookingCode`) с unit-тестами ≥ 80%; в `packages/i18n` — `detectLang`, форматтеры цен/дат/времени по таблице §7, `pickText`, проверка одинаковых ключей во всех языках. Команда `pnpm check` работает.

## Из брифа, дословно

> «10.2 Модель данных
> «5.2 Правила расчёта
> «5.3 Защита от двойной брони
> «Unit-тесты расчёта цены и доступности (покрытие ≥ 80%)»

## Разделы спецификации

Истории 15, 35–38, 55, 56, 60, 62, 92, 93; Решения по реализации; interfaces.md целиком.

## Критерии приёмки

- [ ] `docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev` поднимает API, `/api/health` отвечает 200
- [ ] Вставка двух пересекающихся (с учётом буфера 1 ч) интервалов одного байка отклоняется БД
- [ ] `quote()` даёт верный итог в 10 сценариях приёмки (сроки 1/3/7/30 дней, сезон, опции, депозит) — тест
- [ ] `lateFee`, `refundPercent` (100/50/0), `canTransition` покрыты тестами; покрытие `packages/shared` ≥ 80%
- [ ] `detectLang`: ru/uk/be/kk→ru, vi→vi, прочее→en; `formatPrice` даёт «150 000 ₫ (≈ 530 ₽)», «150,000 ₫ (≈ $5.70)», «150.000 ₫»
- [ ] Сид: демо-модели и цены помечены `isDemo`; точка с адресом пользователя и tz Asia/Ho_Chi_Minh
- [ ] `pnpm check` проходит; `.env.example` содержит все имена из спецификации пустыми
