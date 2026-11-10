# 02 — Дизайн через impeccable и оболочка Mini App

**Требования:** R04, R41, R03, R02, R48, R18, R19, R08, R06, R05
**Зависит от:** 01
**Зона:** `DESIGN.md` · `packages/ui/` · `apps/miniapp/` (кроме `src/features/*/` — только заглушки `index.tsx`) · `packages/i18n/locales/*/common.json`, `onboarding.json`
**Волна:** 2
**Ревью:** нет
**Модель:** сильная

## Что должно заработать

Через скилл impeccable (`.claude/skills/impeccable`: `context`, затем `reference/new-work.md` в режиме Operate, `craft-floor.md`) на основе `design-system/`, `PRODUCT.md` и трёх референсов записан `DESIGN.md`. `packages/ui` — Tailwind-пресет из токенов `design-system/tokens.css` и общие компоненты (Button, IconButton, Chip, Sheet, Badge, Skeleton, PriceText, Icon на Lucide, EmptyState). Mini App открывается в Telegram и в браузере (dev): инициализирует SDK, тему по colorScheme с мгновенной сменой, safe area и content safe area, BackButton, haptic-утилиты, i18n по `language_code`, авторизацию через `POST /auth/telegram` (до таска 04 — мок с тем же контрактом), плавающее нижнее меню из 4 вкладок, ленивые маршруты на все фичи, экран онбординга при первом запуске и экран «Откройте через бота» вне Telegram без dev-режима. Бюджет: JS первого экрана ≤ 250 КБ gzip — проверка `size-limit` в `pnpm check`.

## Из брифа, дословно

> «Используй для дизайна скилл /impeccable
> «оно должно быть быстрое и удобное
> «Тема следует теме Telegram (themeParams, colorScheme), фирменный акцентный цвет постоянный в обеих темах
> «нижнее меню из 4 вкладок»

## Разделы спецификации

Истории 3–9, 12, 44, 78, 89; interfaces.md «Как работать в репозитории»; reference.md.

## Критерии приёмки

- [ ] `DESIGN.md` существует и выведен из `design-system/` (токены, типографика, компоненты), записан по процессу impeccable
- [ ] Смена темы Telegram (light↔dark) меняет приложение без перезагрузки; акцент одинаков в обеих
- [ ] Первый запуск показывает онбординг с выбором языка; повторный — нет
- [ ] Вне Telegram без `DEV_AUTH` показан экран «Откройте через бота»
- [ ] Нижнее меню из 4 вкладок, системная BackButton на не-вкладочных маршрутах
- [ ] `size-limit`: начальный JS ≤ 250 КБ gzip; маршруты фич — отдельные чанки
- [ ] Отступы учитывают `--tg-safe-area-inset-*` и `--tg-content-safe-area-inset-*`; зоны касания ≥ 44 px
