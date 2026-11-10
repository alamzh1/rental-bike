---
name: Аренда Байка
description: Telegram Mini App аренды байков в Куинёне — светлый чистый экран, фото техники на серой подложке, тёмное плавающее меню и один синий акцент действия.
colors:
  bg: "#ffffff"
  bg-dark: "#0e0f12"
  surface: "#f2f3f5"
  surface-dark: "#1a1b20"
  surface-raised: "#ffffff"
  surface-raised-dark: "#23252b"
  line: "#e3e5e9"
  line-dark: "#34363d"
  line-strong: "#7e838c"
  line-strong-dark: "#6e727b"
  ink: "#15161b"
  ink-dark: "#f2f3f5"
  ink-muted: "#666a73"
  ink-muted-dark: "#9b9fa8"
  action-blue: "#0a5cff"
  on-accent: "#ffffff"
  accent-text: "#0a5cff"
  accent-text-dark: "#7aa5ff"
  accent-soft: "#e6eeff"
  accent-soft-dark: "#16244a"
  inverse: "#15161b"
  inverse-dark: "#f2f3f5"
  on-inverse: "#ffffff"
  on-inverse-dark: "#15161b"
  nav: "#15161b"
  nav-dark: "#23252b"
  on-nav: "#ffffff"
  nav-icon: "#8e929b"
  promo-sand: "#f6c56f"
  on-promo: "#1f1708"
  rating: "#f5a400"
  favorite: "#e5394f"
  success: "#117a45"
  success-soft: "#e2f3e9"
  warning: "#965700"
  warning-soft: "#fcefd9"
  danger: "#c21f33"
  danger-soft: "#fbe5e7"
  skeleton: "#e7e9ec"
typography:
  display:
    fontFamily: "Manrope, -apple-system, SF Pro Text, Roboto, Segoe UI, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: "36px"
    letterSpacing: "-0.02em"
  title-1:
    fontFamily: "Manrope, -apple-system, SF Pro Text, Roboto, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: "30px"
    letterSpacing: "-0.01em"
  title-2:
    fontFamily: "Manrope, -apple-system, SF Pro Text, Roboto, Segoe UI, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: "24px"
  headline:
    fontFamily: "Manrope, -apple-system, SF Pro Text, Roboto, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "22px"
  body:
    fontFamily: "Manrope, -apple-system, SF Pro Text, Roboto, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "22px"
  body-strong:
    fontFamily: "Manrope, -apple-system, SF Pro Text, Roboto, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "20px"
  button:
    fontFamily: "Manrope, -apple-system, SF Pro Text, Roboto, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "20px"
  caption:
    fontFamily: "Manrope, -apple-system, SF Pro Text, Roboto, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
  label:
    fontFamily: "Manrope, -apple-system, SF Pro Text, Roboto, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: "16px"
    letterSpacing: "0.02em"
  price-lg:
    fontFamily: "Manrope, -apple-system, SF Pro Text, Roboto, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: "28px"
    fontFeature: "tnum"
  price:
    fontFamily: "Manrope, -apple-system, SF Pro Text, Roboto, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: "22px"
    fontFeature: "tnum"
rounded:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "28px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  control-sm: "36px"
  control-md: "44px"
  control-lg: "52px"
  tabbar-height: "64px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "{spacing.control-md}"
    padding: "0 20px"
  button-primary-lg:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    height: "{spacing.control-lg}"
    padding: "0 24px"
  button-inverse:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
    rounded: "{rounded.md}"
    height: "{spacing.control-md}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "{spacing.control-md}"
  button-ghost:
    textColor: "{colors.accent-text}"
    padding: "0 8px"
    height: "{spacing.control-md}"
  chip-filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    height: "{spacing.control-sm}"
    padding: "0 16px"
  chip-filter-selected:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
  chip-option:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-md}"
    padding: "0 18px"
  chip-option-selected:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
  icon-button:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "{spacing.control-md}"
  badge:
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 10px"
  tabbar:
    backgroundColor: "{colors.nav}"
    textColor: "{colors.nav-icon}"
    rounded: "{rounded.xl}"
    height: "{spacing.tabbar-height}"
    padding: "8px"
  tabbar-item-active:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.on-accent}"
    typography: "{typography.caption}"
    rounded: "{rounded.lg}"
    height: "48px"
    padding: "0 16px"
  sheet:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.xl}"
    padding: "0 16px 16px"
  photo-plate:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
---

# Design System: Аренда Байка

## Overview

**Северная звезда: «Ключ на стойке».** Прокат, где байк уже ждёт: светлая витрина, техника на серой подложке как на стенде, тёмная стойка внизу (меню и панель цены) и одна синяя кнопка, которая делает дело. Интерфейс — рабочий инструмент туриста на улице или в отеле, с телефона, часто на мобильном интернете и в тёмной теме Telegram. Поэтому режим поверхности — **Operate**: скорость, узнаваемые паттерны, ни одного декоративного слоя между человеком и бронью.

Мир задан дизайн-системой в `design-system/` (одобрена пользователем, собрана по трём референсам: Rentaro — онбординг с крупным фото и тёмное плавающее меню; Insightlancer — приветствие, чипы, шторка фильтров; Car Rental — карточки 2 в колонку с ценой «/день»). Этот документ её не заменяет, а фиксирует, как она легла в код: токены — `packages/ui/src/tokens.generated.css` (генерируется из `design-system/tokens.json`), Tailwind-пресет — `packages/ui/tailwind-preset.js`, компоненты — `packages/ui/src/*`, оболочка — `apps/miniapp/src/app/*`.

Характер: чистый, собранный, уверенный. Не «модный стартап» и не «вьетнамская открытка»: брендом здесь работают точность цены, крупное фото байка и синий, который всегда означает «действие».

Светлая или тёмная — решает Telegram (`colorScheme`), а не мы: тема переключается мгновенно по событию `themeChanged`, синий акцент одинаков в обеих.

## Colors

Стратегия **Restrained**: нейтральная витрина + один акцент действия + тёмная «стойка» как второе цветовое поле. Каждый цвет делает работу; декоративного цвета нет.

### Primary
- **Синий действия** (`accent`, #0a5cff, одинаков в обеих темах) — только заливка: главная кнопка экрана («Забронировать», «Оплатить»), активная вкладка меню, концы диапазона дат, ползунок цены, Telegram MainButton. Текст на нём — `on-accent`. Ссылки и текстовые кнопки — `accent-text` (в тёмной теме светлее, #7aa5ff).
- `accent-soft` — полоса выбранного диапазона дат и бейдж «Подтверждена».

### Secondary
- **Тёмная стойка** (`nav`, `inverse`) — плавающее меню и панель цены, тёмные в обеих темах; выбранный чип и вариант фильтра (`inverse` / `on-inverse`).

### Tertiary
- **Песочный промо** (`promo`, #f6c56f) — только промо-баннер. Резерв: если заказчик выберет тёплый акцент для вьетнамского рынка, `promo` займёт место `accent`.

### Neutral
- `bg` — экран; `surface` — подложка фото, карточки каталога, неактивные чипы, плитки; `surface-raised` — шторки, карточки броней, отзывы (с рамкой `line`).
- Текст: `ink` и `ink-muted`. Других серых для текста нет.
- `line` — декоративные разделители; `line-strong` — рамки контролов и ручка шторки (≥ 3:1).

### Named Rules
- **Синий не выбирает.** Выбор (чип, вариант, дата внутри диапазона) — `inverse` или `accent-soft`, никогда не заливка `accent`. Синий оставлен для действия.
- **Одна синяя заливка на экран.** Если внизу Telegram MainButton — своей primary-кнопки нет.
- **Статус читается словом.** `warning` — «Ожидает оплаты», `accent-text` на `accent-soft` — «Подтверждена», `success` — «Выдана», `ink-muted` на `surface` — «Завершена»/«Отменена», `danger` — «Проблема» (`bookingStatusTone()`).
- **Никаких литеральных цветов в коде.** Только классы пресета (`bg-surface`, `text-ink-muted`) или `var(--token)`.

## Typography

Одно семейство — **Manrope** 400–800 (кириллица и вьетнамская диакритика), запасной стек — системный шрифт Telegram. Подключено из Google Fonts с `display=swap`.

### Hierarchy
Каждый стиль — один класс Tailwind: размер, интерлиньяж, вес и трекинг сразу.
- `text-display` 30/36 800 — только онбординг и «Бронь подтверждена».
- `text-title-1` 24/30 800 — приветствие на главной, название модели.
- `text-title-2` 19/24 700 — секции и шторки.
- `text-headline` 17/22 700 — шапка экрана, карточка брони, заголовок пустого состояния.
- `text-body` 15/22 500 — основной текст; меньше 15px для чтения не используем.
- `text-body-strong` 15/20 700 — названия в сетке, значения, строки итога.
- `text-button` 15/20 700 — подписи кнопок, без капса.
- `text-caption` 13/18 500 — метаданные, «/день», чипы-фильтры, пересчёт «≈».
- `text-label` 12/16 700 +0.02em — бейджи и рейтинг.
- `text-price-lg` 22/28 800 и `text-price` 17/22 800 — деньги, всегда `tabular` (tabular-nums).

### Named Rules
- **Цифры не прыгают.** Цены, таймеры, календарь — класс `tabular`.
- **Текст не обрезается.** VI и RU длиннее EN на 20–40%: кнопки и чипы растут по ширине; многоточие — только название модели в сетке 2 колонки. Заголовки — `text-balance`.
- **Сумма в донгах первой.** `PriceText`: «150 000 ₫» стилем цены, «≈ 530 ₽» — `caption` в `ink-muted` (на тёмной панели — `nav-icon`).

## Layout

- **Колонка до 480px** (`max-w-app`), по центру на десктопе; от 360px на телефоне. Боковое поле экрана `space-4`.
- **Сетка 4 pt**: все отступы — шаги пресета (`1`=4 … `12`=48). Полушаги 6/10/14 — только внутри бейджей и чипов.
- **Safe area Telegram**: верх `--safe-top` = `--tg-safe-area-inset-top` + `--tg-content-safe-area-inset-top`; низ `--safe-bottom` — сумма нижних вставок Telegram или `env(safe-area-inset-bottom)`, что больше. Значения пишет оболочка из событий `safe_area_changed` / `content_safe_area_changed` (Bot API 8.0+, включая полноэкранный режим); на старых клиентах работает `env()`.
- **Вкладки и «Назад».** Четыре вкладки (Главная, Мои брони, Избранное, Профиль). На корне вкладки — плавающее меню, контенту снизу резерв `tabbar-height + space-12 + safe-bottom`. На любом другом маршруте меню нет, работает системная `BackButton`; в браузерном dev-режиме вместо неё — круглая кнопка со стрелкой в шапке.
- **Главное действие внизу.** `MainAction`: в Telegram — MainButton (`accent` / `on-accent`), в браузере — своя кнопка 52px над safe area.
- **Каталог** — 2 колонки с зазором `space-3`; популярные — горизонтальная лента карточек 160px.
- **Касания** ≥ 44px: у контролов 36px (чип-фильтр, кнопка `sm`, сердце 32px) зона добирается невидимым `::after` (класс `hit-44`).

## Elevation & Depth

Плоская витрина, приподнятая стойка. Карточки — заливка `surface` без тени. Тень есть только у слоёв, которые плавают над контентом:
- `shadow-nav` (0 8 24, мягкая) — плавающее меню и панель цены.
- `shadow-sheet` (0 −8 32) — нижняя шторка.
- `scrim` — затемнение под шторкой.

### Named Rules
- **Тень значит «плавает».** Ни карточка, ни кнопка тени не получают.

## Shapes

Радиус по роли:
- `pill` — чипы-фильтры, поиск, бейджи, круглые иконки-кнопки.
- `xs` 8 — мини-фото в брони, строки-подсказки скелетона.
- `sm` 12 — крупные варианты в шторке, кнопка `sm`, блоки скелетона.
- `md` 16 — кнопки и плитки характеристик.
- `lg` 20 — карточки каталога и баннер, активная вкладка.
- `xl` 28 — меню, панель цены, верх шторки, подложка фото на онбординге.

Подложка фото: `surface`, байк вырезан, ракурс 3/4 носом вправо, 80% ширины; 4:3 в каталоге, 16:10 в галерее. Пока фото нет — контур байка из дизайн-системы, наложенный маской цвета `line-strong` (`BikePlate`).

## Components

Все общие компоненты — `@rental/ui`; тексты приходят пропсами из i18n, своих строк в компонентах нет.

### Buttons
`Button` — `primary` / `inverse` / `secondary` / `ghost`, высоты `sm` 36 / `md` 44 / `lg` 52, `block`, иконка Lucide справа или слева. Нажатие — масштаб 0.98 и затемнение за 150 мс. `loading` — `aria-busy`, неактивна, текст остаётся глаголом. Неактивная кнопка объясняет причину текстом («Нет на эти даты»), а не только серостью. `IconButton` — круг 44 с рамкой `line`; варианты `inverse` (фильтры), `surface`, `float` (32 поверх фото, сердце закрашивается `favorite` при `pressed`). Подпись `label` обязательна.

### Chips
`Chip` `filter` — пилюля 36 на `surface`; `option` — 44, `radius-sm`, рамка `line-strong`. Выбранный — `inverse`. `ChipGroup` с `role="group"` и подписью, `scroll` — ряд уходит под боковые поля. Каждое нажатие — `haptic.selection()`.

### Cards / Containers
Карточки плоские на `surface` (`radius-lg`); шторки и карточки броней — `surface-raised` + рамка `line`. Вложенных карточек нет. Цветных полос по краю нет.

### Inputs / Fields
Поле — рамка `line-strong`, каретка `accent`, кольцо фокуса `focus-ring` 2px со смещением 2px. Выделение текста — `accent-soft`.

### Navigation
`TabBar` (оболочка Mini App) — тёмная пилюля `nav` 64px, `radius-xl`, `shadow-nav`, на `space-3` выше нижней safe area. Активная вкладка — пилюля `accent` с иконкой и подписью (подпись появляется плавно за 200 мс), остальные — иконки `nav-icon` с `aria-label`. Скрыта на всех не-вкладочных экранах.

### Sheet
`Sheet` — нижняя шторка: ручка, заголовок `title-2`, круглая кнопка закрытия, прокручиваемое тело, футер над safe area. Выезжает за 250 мс, скрим закрывает, Escape закрывает, фокус заперт внутри и возвращается.

### Badge
`Badge` — слово + точка `currentColor`, тона по статусу; `plain` без точки для служебных меток («Нужны права A»).

### Skeleton / EmptyState
`Skeleton` по форме будущего контента (`block` / `text` / `circle`), контейнер с `aria-busy`; `useDelayedFlag` не показывает скелетон, если ответ пришёл быстрее 200 мс. Перелив 1.2 с отключается при «уменьшить движение». `EmptyState` — иконка в круге `surface` (у ошибки `danger-soft`), заголовок `headline`, одна строка `ink-muted`, одна кнопка. Ошибка говорит, что случилось и что делать, без извинений.

### PriceText
Сумма в донгах + суффикс («/день», «за 7 дней») + пересчёт «≈» вторым цветом; `approxLayout="below"` для панели цены.

### Signature: «стойка» внизу
Тёмный плавающий слой внизу экрана — единственное место с тенью и единственный тёмный элемент в светлой теме: меню на вкладках, панель цены на карточке байка. Синий внутри него — всегда то, что нажать.

## Do's and Don'ts

### Do:
- Бери цвета, радиусы, тени и типографику только из пресета `@rental/ui/preset`.
- Иконки — Lucide через `Icon` (16/20/24, штрих 2px, `currentColor`); закрашиваются только звезда рейтинга и сердце избранного.
- Тексты — только ключи `packages/i18n`; обращение на «ты» / «you» / «bạn», кнопки — глаголы, без эмодзи.
- Haptic: `selection` — даты и чипы, `impact('light')` — избранное, `notification('success'|'error')` — оплата (`useHaptic()`).
- Анимации 150–250 мс, ease-out (`ease-out` пресета = cubic-bezier(0.22, 1, 0.36, 1)); при «уменьшить движение» — мгновенно.
- Загрузка — скелетон по форме контента.

### Don't:
- Не крась выбор синим и не ставь вторую синюю заливку на экран.
- Не добавляй тени карточкам, градиентный текст, стекло, цветные полосы по краю, надзаголовки над заголовками.
- Не используй спиннеры для списков и экранов.
- Не обрезай вьетнамский и русский текст многоточием (кроме названия модели в сетке).
- Не рисуй свою кнопку «Назад» в Telegram — только системная `BackButton`.
- Не выдумывай цены, модели, отзывы и логотипы брендов: демо-данные помечаются «ДЕМО», бренды без логотипов — текстовыми чипами.
