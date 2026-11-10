window.STATE =
{
  "version": 2,
  "slug": "bike-rental-miniapp",
  "dir": "2026-10-28-bike-rental-miniapp",
  "title": "Аренда Байка — Telegram Mini App",
  "mode": "semi",
  "depth": "normal",
  "tier": "T3",
  "briefFile": "2026-10-28-brief.md",
  "memoryFile": "AGENTS.md",
  "memoryOwner": "autopilot",
  "skillDir": "/Users/a123/.claude/skills/autopilot",
  "baseCommit": "352e04a",
  "startedAt": "2026-10-28T17:36:26+07:00",
  "updatedAt": "2026-10-28T22:14:29+07:00",
  "finishedAt": "2026-10-28T22:14:29+07:00",
  "stages": [
    {
      "id": "preflight",
      "status": "done",
      "startedAt": "2026-10-28T17:36:26+07:00",
      "finishedAt": "2026-10-28T17:36:37+07:00"
    },
    {
      "id": "manifest",
      "status": "done",
      "startedAt": "2026-10-28T17:36:37+07:00",
      "finishedAt": "2026-10-28T17:37:19+07:00"
    },
    {
      "id": "briefing",
      "status": "done",
      "startedAt": "2026-10-28T17:37:19+07:00",
      "finishedAt": "2026-10-28T17:41:06+07:00"
    },
    {
      "id": "spec",
      "status": "done",
      "startedAt": "2026-10-28T17:41:06+07:00",
      "finishedAt": "2026-10-28T17:46:25+07:00"
    },
    {
      "id": "plan",
      "status": "done",
      "startedAt": "2026-10-28T17:46:25+07:00",
      "finishedAt": "2026-10-28T17:48:59+07:00"
    },
    {
      "id": "build",
      "status": "done",
      "startedAt": "2026-10-28T17:48:59+07:00",
      "finishedAt": "2026-10-28T21:02:51+07:00"
    },
    {
      "id": "review",
      "status": "done",
      "startedAt": "2026-10-28T21:02:51+07:00",
      "finishedAt": "2026-10-28T21:32:24+07:00"
    },
    {
      "id": "final",
      "status": "done",
      "startedAt": "2026-10-28T21:32:24+07:00",
      "finishedAt": "2026-10-28T22:14:29+07:00"
    }
  ],
  "requirements": {
    "total": 56,
    "done": 54,
    "inTicket": 0,
    "inSpec": 0,
    "placeholder": 1,
    "deferred": 1,
    "dropped": 0
  },
  "tickets": [
    {
      "id": "01",
      "title": "Каркас, схема данных и правила расчёта",
      "requirements": [
        "R42",
        "R43",
        "R28",
        "R29",
        "R30",
        "R49",
        "R54i",
        "R56i",
        "R37"
      ],
      "blockedBy": [],
      "wave": 1,
      "zone": [
        "package.json",
        "pnpm-workspace.yaml",
        "docker-compose.yml",
        ".env.example",
        "apps/api/",
        "prisma/",
        "app.module.ts",
        "packages/shared/",
        "packages/i18n/",
        "formatters",
        "scripts/"
      ],
      "review": "да — фундамент",
      "model": "сильная",
      "status": "done",
      "startedAt": "2026-10-28T17:49:14+07:00",
      "finishedAt": "2026-10-28T18:23:00+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 110,
        "failed": 0
      },
      "commit": "9dc411b"
    },
    {
      "id": "02",
      "title": "Дизайн через impeccable и оболочка Mini App",
      "requirements": [
        "R04",
        "R41",
        "R03",
        "R02",
        "R48",
        "R18",
        "R19",
        "R08",
        "R06",
        "R05"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "DESIGN.md",
        "packages/ui/",
        "apps/miniapp/",
        "src/features/*/",
        "index.tsx",
        "packages/i18n/locales/*/common.json",
        "onboarding.json"
      ],
      "review": "нет",
      "model": "сильная",
      "status": "done",
      "startedAt": "2026-10-28T18:20:46+07:00",
      "finishedAt": "2026-10-28T18:43:06+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 185,
        "failed": 0
      },
      "commit": "056b1ab"
    },
    {
      "id": "03",
      "title": "Фото демо-моделей через Higgsfield",
      "requirements": [
        "R54i",
        "R48"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "apps/api/prisma/seed-assets/",
        "scripts/photos/"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "done",
      "startedAt": "2026-10-28T18:20:46+07:00",
      "finishedAt": "2026-10-28T18:31:20+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 110,
        "failed": 0
      },
      "commit": "faa30f4"
    },
    {
      "id": "04",
      "title": "API: вход, каталог, доступность, цена",
      "requirements": [
        "R07",
        "R44",
        "R11",
        "R20",
        "R21",
        "R22",
        "R25",
        "R27",
        "R17",
        "R50",
        "R37"
      ],
      "blockedBy": [
        "01"
      ],
      "wave": 2,
      "zone": [
        "apps/api/src/{auth,catalog,availability,pricing,analytics,favorites,i18n}/",
        "packages/shared/src/api/{auth,catalog,pricing,analytics}.ts"
      ],
      "review": "да — сессии и вход",
      "model": "сильная",
      "status": "done",
      "startedAt": "2026-10-28T18:20:46+07:00",
      "finishedAt": "2026-10-28T18:37:42+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 167,
        "failed": 0
      },
      "commit": "ed9cf40"
    },
    {
      "id": "05",
      "title": "API: бронь, оплата, отмена, документы",
      "requirements": [
        "R29",
        "R30",
        "R32",
        "R33",
        "R34",
        "R35",
        "R36",
        "R45",
        "R46",
        "R47",
        "R55i"
      ],
      "blockedBy": [
        "04"
      ],
      "wave": 3,
      "zone": [
        "apps/api/src/{bookings,payments,jobs,documents}/",
        "packages/shared/src/api/{bookings,payments,documents}.ts"
      ],
      "review": "да — деньги",
      "model": "сильная",
      "status": "done",
      "startedAt": "2026-10-28T18:36:21+07:00",
      "finishedAt": "2026-10-28T19:00:22+07:00",
      "retries": 0,
      "repairs": 1,
      "repairFindings": [
        "в production без PAYOS_* TestProvider не активен, webhook не принимает тела с ключом тестового провайдера"
      ],
      "tests": {
        "passed": 260,
        "failed": 0
      },
      "commit": "d09869c"
    },
    {
      "id": "06",
      "title": "Бот, уведомления, договор, курс и чек",
      "requirements": [
        "R15",
        "R40",
        "R45",
        "R34",
        "R55i"
      ],
      "blockedBy": [
        "05"
      ],
      "wave": 4,
      "zone": [
        "apps/api/src/{notifications,contracts,rates}/",
        "packages/i18n/locales/*/{bot,contract}.json"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "done",
      "startedAt": "2026-10-28T18:55:45+07:00",
      "finishedAt": "2026-10-28T19:05:43+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 334,
        "failed": 0
      },
      "commit": "378f5e1"
    },
    {
      "id": "07",
      "title": "Mini App: главная, даты, каталог, карточка, избранное",
      "requirements": [
        "R10",
        "R09",
        "R27",
        "R20",
        "R21",
        "R12",
        "R22",
        "R25",
        "R17",
        "R11"
      ],
      "blockedBy": [
        "02",
        "04"
      ],
      "wave": 3,
      "zone": [
        "apps/miniapp/src/features/{home,dates,catalog,bike,favorites}/",
        "packages/i18n/locales/*/{home,catalog,bike,favorites}.json"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "done",
      "startedAt": "2026-10-28T18:43:07+07:00",
      "finishedAt": "2026-10-28T18:57:37+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 257,
        "failed": 0
      },
      "commit": "6fc3484"
    },
    {
      "id": "08",
      "title": "Mini App: оформление, оплата, мои брони, профиль",
      "requirements": [
        "R13",
        "R14",
        "R23",
        "R24",
        "R26",
        "R33",
        "R34",
        "R45",
        "R16",
        "R05",
        "R32",
        "R35"
      ],
      "blockedBy": [
        "02",
        "05"
      ],
      "wave": 4,
      "zone": [
        "apps/miniapp/src/features/{checkout,payment,bookings,profile,documents}/",
        "packages/i18n/locales/*/{checkout,payment,bookings,profile,errors}.json"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "done",
      "startedAt": "2026-10-28T18:55:45+07:00",
      "finishedAt": "2026-10-28T19:39:35+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 363,
        "failed": 0
      },
      "commit": "4416241"
    },
    {
      "id": "09",
      "title": "Режим менеджера: выдача и возврат по QR",
      "requirements": [
        "R39",
        "R35",
        "R30",
        "R45"
      ],
      "blockedBy": [
        "02",
        "05"
      ],
      "wave": 4,
      "zone": [
        "apps/miniapp/src/features/manager/",
        "apps/api/src/manager/",
        "packages/shared/src/api/manager.ts",
        "packages/i18n/locales/*/manager.json"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "done",
      "startedAt": "2026-10-28T18:57:37+07:00",
      "finishedAt": "2026-10-28T19:37:12+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 363,
        "failed": 0
      },
      "commit": "2584ee1"
    },
    {
      "id": "10",
      "title": "Админка: вход, дашборд, брони, шахматка",
      "requirements": [
        "R38",
        "R07",
        "R47",
        "R50"
      ],
      "blockedBy": [
        "05"
      ],
      "wave": 4,
      "zone": [
        "apps/admin/",
        "apps/api/src/admin/{auth,dashboard,bookings,chess}/",
        "packages/shared/src/api/admin.ts",
        "packages/i18n/locales/*/admin.json"
      ],
      "review": "да — вход и сессии",
      "model": "сильная",
      "status": "done",
      "startedAt": "2026-10-28T19:05:43+07:00",
      "finishedAt": "2026-10-28T19:59:38+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 407,
        "failed": 0
      },
      "commit": "9cf8118"
    },
    {
      "id": "11",
      "title": "Админка: парк, цены, точки, тексты, платежи, настройки",
      "requirements": [
        "R38",
        "R36",
        "R37",
        "R54i",
        "R28",
        "R46"
      ],
      "blockedBy": [
        "10"
      ],
      "wave": 5,
      "zone": [
        "apps/admin/src/{fleet,prices,locations,texts,payments,settings,banner}/",
        "apps/api/src/admin/{fleet,prices,locations,texts,payments,settings,banner}/",
        "packages/i18n/locales/*/admin-fleet.json"
      ],
      "review": "да — деньги (возвраты)",
      "model": "сильная",
      "status": "done",
      "startedAt": "2026-10-28T19:57:39+07:00",
      "finishedAt": "2026-10-28T20:29:42+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 436,
        "failed": 0
      },
      "commit": "bdd248a"
    },
    {
      "id": "12",
      "title": "Сквозные тесты, документация, финальная полировка",
      "requirements": [
        "R01",
        "R52",
        "R53",
        "R49",
        "R51",
        "R48",
        "R02",
        "R05",
        "R04",
        "R50"
      ],
      "blockedBy": [
        "06",
        "07",
        "08",
        "09",
        "11"
      ],
      "wave": 6,
      "zone": [
        "e2e/",
        "load/",
        "docs/",
        "README.md",
        "packages/i18n/glossary.md",
        "apps/miniapp/",
        "packages/ui/"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "done",
      "startedAt": "2026-10-28T20:27:39+07:00",
      "finishedAt": "2026-10-28T21:02:51+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 436,
        "failed": 0
      },
      "commit": "625ff37"
    },
    {
      "id": "F1",
      "title": "Исправления по код-ревью ветки",
      "requirements": [
        "R47",
        "R44",
        "R46",
        "R56i",
        "R24",
        "R34",
        "R13",
        "R14",
        "R49",
        "R40",
        "R39"
      ],
      "blockedBy": [],
      "wave": 7,
      "zone": [
        "apps/api/prisma/seed.ts",
        "apps/api/src/auth/",
        "apps/api/src/main.ts",
        "apps/api/src/payments/payments.service.ts",
        "apps/api/src/jobs/",
        "apps/api/src/documents/documents.service.ts",
        "apps/api/src/manager/manager.service.ts",
        "apps/api/src/admin/{bookings,fleet,chess,dashboard}/",
        "apps/api/src/auth/",
        "apps/api/package.json",
        "docker-compose.yml",
        "apps/admin/vite.config.ts",
        "apps/miniapp/vite.config.ts",
        "e2e/serve-api.mjs",
        "docs/deploy.md",
        "apps/miniapp/src/features/{bookings,catalog,bike,checkout,manager,payment}/",
        "apps/miniapp/src/app/screens/",
        "apps/miniapp/test/",
        "packages/i18n/locales/*/{bookings,errors}.json",
        "package.json",
        "pnpm-lock.yaml",
        "apps/api/test/"
      ],
      "review": "да — ремонт ветки",
      "model": "сильная",
      "status": "done",
      "startedAt": "2026-10-28T21:09:57+07:00",
      "finishedAt": "2026-10-28T21:32:24+07:00",
      "retries": 0,
      "repairs": 0,
      "tests": {
        "passed": 512,
        "failed": 0
      },
      "commit": "4a0092c"
    },
    {
      "id": "F2",
      "title": "Расхождения слепой приёмки",
      "requirements": [
        "R24",
        "R50",
        "R22",
        "R17"
      ],
      "blockedBy": [],
      "wave": 8,
      "zone": [
        "apps/miniapp/src/features/{bookings,bike,home,catalog}/",
        "apps/miniapp/src/app/",
        "apps/api/src/{analytics,catalog}/",
        "apps/api/prisma/seed.ts",
        "packages/i18n/locales/*/{bookings,bike,home}.json"
      ],
      "review": "нет",
      "model": "обычная",
      "status": "done",
      "retries": 0,
      "repairs": 1,
      "startedAt": "2026-10-28T22:01:23+07:00",
      "repairFindings": [
        "staff-scope.spec не зависит от времени суток; restrictionsText редактируется в админке"
      ],
      "finishedAt": "2026-10-28T22:13:23+07:00",
      "tests": {
        "passed": 538,
        "failed": 0
      },
      "commit": "2658a3c"
    }
  ],
  "tests": {
    "passed": 538,
    "failed": 0
  },
  "debt": {
    "placeholders": [
      "Демо-парк: модели, цены, депозиты, опции, доплата, курсы — isDemo",
      "Тексты договора, правил, FAQ, контакт менеджера — «[… — впиши]»",
      "Координаты точки — приблизительно центр Куинёна",
      "Фото моделей — сгенерированные Higgsfield (18 шт., ~27 кредитов), помечены demo",
      "Договор: «[РЕКВИЗИТЫ АРЕНДОДАТЕЛЯ — впиши]», текст условий — демо-заглушка в настройках",
      "FAQ, правила, политика, контакт менеджера и поддержки — «[… — впиши в настройках админки]»",
      "Текст о правах Вьетнама и VI-строки — на проверку заказчиком и вычитку носителем",
      "VI-переводы: 1142 ключа, не вычитаны носителем (docs/i18n-vi-review.md)",
      "Ограничения по пробегу и поездкам между провинциями — заглушка, вписать в админке («Тексты»)"
    ],
    "assumptions": [
      "Название бренда на EN «Bike Rental» и VI «Thuê Xe Máy»",
      "VietQR одним QR берёт аренду и депозит; при отмене процент только к аренде, депозит возвращается полностью; возврат PENDING до отметки админа"
    ],
    "emptyEnv": []
  },
  "additions": [],
  "coverage": {
    "found": 37,
    "fixed": 36,
    "deferred": 1,
    "items": [
      "Figma-макеты и кликабельный прототип (§9, §13.1) — вне рамок: дизайн делается через impeccable в коде"
    ]
  },
  "concerns": [
    "docker-compose: официальные образы MinIO недоступны — D01, в dev локальное хранилище на диске",
    "Порты по умолчанию 5442/6389/9010 — стандартные заняты на машине",
    "migration.sql:658 — триггер blocked_until только на UPDATE OF end_at/buffer; запись blockedUntil через Prisma снимает буфер",
    "seed.ts:24 — точка без isDemo при приблизительных координатах; адрес дополнен «Gia Lai, Việt Nam»",
    "main.ts:11 — cors: true для любого origin; в prod ограничить MINIAPP_URL/ADMIN_URL",
    "docker-compose.yml:13,25,41 — порты на 0.0.0.0 с паролями по умолчанию",
    "rules.ts:31 — ровно 24 ч до выдачи дают 50% (ТЗ: «более 24 часов» → 100%), сверить",
    "Фото: сплошной светло-серый фон вместо альфа-выреза; rear34 развёрнут иначе",
    "Сид: нет баннера, сезонов и conditions — /home banner:null, условия в карточке null",
    "URL фото: S3_PUBLIC_URL или API_PUBLIC_URL/api/files/public — свести с Storage.publicUrl (T05)",
    "auth.service.ts:24 — DEV_AUTH выключается только при NODE_ENV=production; при пустом NODE_ENV аноним получает ADMIN-сессию — разрешать только при NODE_ENV=development|test (БЕЗОПАСНОСТЬ)",
    "auth.service.ts:107 — devUser='constructor' даёт 500; принимать только client|manager|admin",
    "auth.service.ts:80 — причина отказа 401 (BAD_SIGNATURE/EXPIRED) уходит клиенту; наружу только UNAUTHORIZED",
    "design-system/tokens.css не разбирается PostCSS (лишние «}}» в классах типографики) — CSS-переменные генерируются из tokens.json",
    "impeccable пройден частично: без concept-seed, страницы выбора направления и .impeccable/design.json",
    "Manrope грузится с Google Fonts, не с собственного сервера",
    "Название EN «Bike Rental», VI «Thuê Xe Máy» — допущение",
    "Rate limit 10/мин в памяти процесса — на каждый инстанс свой счётчик",
    "Менеджер без точки видит документы всех клиентов",
    "Журнал пишется прямо в AuditLog, модуль audit пуст",
    "refundPercent: ровно 24 ч → 50% (строгая граница «более 24 ч»)",
    "Пересчёт «≈ ₽/$» в каталоге не показан — нет эндпоинта курсов (поручено T06: GET /rates)",
    "«Нужен байк сейчас» ведёт в каталог, а не сразу на оплату для повторного клиента",
    "EN/VI экраны каталога визуально не проверялись, только паритет ключей",
    "payments.service.ts:129 — оплата после отмены/второй QR: PAID late без записи REFUND PENDING",
    "bookings.service.ts:143 — FOR UPDATE SKIP LOCKED даёт ложный 409 при параллельных бронях одного байка на разные даты",
    "documents.service.ts:105 — менеджер без точки читает документы всех клиентов (история 54: «менеджеру точки»)",
    "webhook-ip.ts:2 — нет trust proxy: за прокси при PAYOS_WEBHOOK_IPS все webhook 403; записать в деплой",
    "payments.service.ts:89 — orderCode=seq*100+attempt%100 повторяется на 101-й попытке",
    "payments-production.spec.ts — третий тест зависит от платежа второго, не запускается отдельно",
    "Бот: в подтверждении брони нет QR-картинки (ТЗ §8.3 «Подтверждение с деталями и QR») — только код и кнопка в Mini App",
    "Алерт о PAYMENT_PROVIDER_ERROR и падении hold-expiry не подключён — нужен хук в payments/jobs",
    "Шрифты PDF не копируются nest build — путь через запасной ход в src/contracts/fonts",
    "Интеграционные тесты параллельных тасков делят БД rental_test и затирают друг друга",
    "Сканер QR (openQrScanner) в реальном Telegram не проверялся",
    "Клиенту нет уведомления, что акт выдачи ждёт подтверждения — нет события в BookingEvents",
    "Адрес доставки уходит строкой «адрес [lat, lng]» — в API нет полей координат",
    "QR — собственный генератор qr.ts (без библиотеки)",
    "В сиде deliveryFee=null — доставка не видна до настройки",
    "Выручка на дашборде — по броням с началом в периоде, не по поступившим деньгам",
    "Cookie-сессия админки — только при одном адресе с API; для разных доменов нужен CORS с credentials",
    "Клиент «с улицы» — User telegramId walkin:<phone>, уведомления бота ему уходят в лог",
    "Вёрстка админки в браузере не проверялась",
    "Менеджер без locationId видит брони, шахматку и документы всех точек (fail-open) — admin-bookings/chess/dashboard и manager.service:172",
    "История 84: менеджеру в карточке брони отдаются payments[], totalAmount, paidAmount — скрыть или оформить решением",
    "Нет теста: менеджер точки A → 404 на бронь и документы точки B",
    "Выход из админки стирает cookie, токен действует до 12 ч",
    "sharp в корневых devDependencies — для prod-сборки API нужен в apps/api dependencies",
    "Публичные файлы на S3 пишет свой хелпер admin/fleet/images.ts — в Storage нет public put",
    "Защита от повторного возврата — в памяти одного процесса",
    "Курсы, сохранённые вручную, перезаписывает ежедневное обновление T06",
    "Админка (парк, цены, настройки) в браузере не проверялась",
    "admin-payments.service.ts reconcile — переплата остаётся OVERPAID после возврата излишка; нет теста на OVERPAID",
    "admin-payments.service.ts reconcile — отменённая бронь с refundAmount>0 без REFUND не подсвечивается (нужен REFUND_DUE)",
    "admin-payments.service.ts refund — проверка дубля и остатка вне транзакции, без FOR UPDATE (риск двойного возврата при 2 инстансах)",
    "admin-payments.service.ts refund — удержания из депозита не вычитаются из остатка к возврату",
    "fleet.service.ts scope — менеджер без точки видит парк всех точек",
    "main.ts — trust proxy не включён (за прокси при PAYOS_WEBHOOK_IPS webhook отклоняются)",
    "Сценарий нагрузки k6 не запускался — k6 не установлен",
    "impeccable: открытые P2–P3 — user-scalable=no, контур байка на онбординге вместо фото"
  ],
  "blind": {
    "checked": 52,
    "matched": 45,
    "mismatches": [
      "Из чистого клона проект не поднимался: код хранилища скрыт .gitignore, design-system/ не в git — исправлено коммитом 3fa9263",
      "R17 «Нужен байк сейчас» не ведёт сразу к оформлению/оплате — F2",
      "R22 в условиях нет документов и ограничений; показано «31 отзыв» без отзывов — F2",
      "R24 карточка в «Моих бронях» без суммы и времени возврата — F2",
      "R50 воронка: «открыли приложение 0» — событие открытия не отправляется — F2",
      "R20 промо-баннер на главной не виден — в демо-данных не заполнен (настраивается в админке)",
      "R40 напоминания за 24 ч и 12 ч до возврата в живом прогоне не наблюдались (покрыты тестами)"
    ]
  },
  "beats": [
    "2026-10-28T17:36:26+07:00",
    "2026-10-28T17:36:37+07:00",
    "2026-10-28T17:36:48+07:00",
    "2026-10-28T17:37:19+07:00",
    "2026-10-28T17:37:34+07:00",
    "2026-10-28T17:41:02+07:00",
    "2026-10-28T17:41:06+07:00",
    "2026-10-28T17:46:25+07:00",
    "2026-10-28T17:47:03+07:00",
    "2026-10-28T17:48:41+07:00",
    "2026-10-28T17:48:48+07:00",
    "2026-10-28T17:48:59+07:00",
    "2026-10-28T17:49:14+07:00",
    "2026-10-28T18:20:10+07:00",
    "2026-10-28T18:20:46+07:00",
    "2026-10-28T18:23:00+07:00",
    "2026-10-28T18:31:20+07:00",
    "2026-10-28T18:36:21+07:00",
    "2026-10-28T18:36:36+07:00",
    "2026-10-28T18:37:42+07:00",
    "2026-10-28T18:43:06+07:00",
    "2026-10-28T18:43:07+07:00",
    "2026-10-28T18:55:45+07:00",
    "2026-10-28T18:57:37+07:00",
    "2026-10-28T18:58:02+07:00",
    "2026-10-28T18:59:40+07:00",
    "2026-10-28T19:00:22+07:00",
    "2026-10-28T19:05:43+07:00",
    "2026-10-28T19:37:12+07:00",
    "2026-10-28T19:37:13+07:00",
    "2026-10-28T19:39:35+07:00",
    "2026-10-28T19:57:39+07:00",
    "2026-10-28T19:59:38+07:00",
    "2026-10-28T20:27:38+07:00",
    "2026-10-28T20:27:39+07:00",
    "2026-10-28T20:29:42+07:00",
    "2026-10-28T21:02:51+07:00",
    "2026-10-28T21:09:56+07:00",
    "2026-10-28T21:09:57+07:00",
    "2026-10-28T21:30:40+07:00",
    "2026-10-28T21:32:24+07:00",
    "2026-10-28T22:01:23+07:00",
    "2026-10-28T22:01:32+07:00",
    "2026-10-28T22:11:23+07:00",
    "2026-10-28T22:13:23+07:00",
    "2026-10-28T22:14:29+07:00"
  ],
  "rev": 95,
  "waiting": null,
  "waits": [
    {
      "kind": "briefing",
      "from": "2026-10-28T17:37:34+07:00",
      "to": "2026-10-28T17:41:02+07:00"
    }
  ],
  "log": [
    {
      "t": "2026-10-28T17:36:26+07:00",
      "k": "init"
    },
    {
      "t": "2026-10-28T17:36:37+07:00",
      "k": "stage",
      "id": "manifest",
      "act": "start"
    },
    {
      "t": "2026-10-28T17:37:19+07:00",
      "k": "stage",
      "id": "briefing",
      "act": "start"
    },
    {
      "t": "2026-10-28T17:37:34+07:00",
      "k": "ask",
      "kind": "briefing",
      "note": "4 вопроса — объём сборки, оплата и бот, данные парка, акцентный цвет"
    },
    {
      "t": "2026-10-28T17:41:02+07:00",
      "k": "answered",
      "kind": "briefing"
    },
    {
      "t": "2026-10-28T17:41:06+07:00",
      "k": "gate",
      "g": "G1",
      "ok": false,
      "open": 55,
      "total": 56
    },
    {
      "t": "2026-10-28T17:41:06+07:00",
      "k": "stage",
      "id": "spec",
      "act": "start"
    },
    {
      "t": "2026-10-28T17:46:25+07:00",
      "k": "gate",
      "g": "G2",
      "ok": true,
      "found": 37,
      "fixed": 36,
      "deferred": 1
    },
    {
      "t": "2026-10-28T17:46:25+07:00",
      "k": "stage",
      "id": "plan",
      "act": "start"
    },
    {
      "t": "2026-10-28T17:47:03+07:00",
      "k": "tier",
      "v": "T3"
    },
    {
      "t": "2026-10-28T17:48:41+07:00",
      "k": "tickets",
      "n": 12
    },
    {
      "t": "2026-10-28T17:48:41+07:00",
      "k": "gate",
      "g": "G3",
      "ok": true,
      "problems": 0
    },
    {
      "t": "2026-10-28T17:48:59+07:00",
      "k": "stage",
      "id": "build",
      "act": "start"
    },
    {
      "t": "2026-10-28T17:49:14+07:00",
      "k": "ticket",
      "ids": [
        "01"
      ],
      "act": "start"
    },
    {
      "t": "2026-10-28T18:20:10+07:00",
      "k": "ticket",
      "ids": [
        "01"
      ],
      "act": "done",
      "tests": {
        "passed": 110,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T18:20:10+07:00",
      "k": "add",
      "key": "debt.placeholders",
      "n": 3
    },
    {
      "t": "2026-10-28T18:20:10+07:00",
      "k": "add",
      "key": "concerns",
      "n": 2
    },
    {
      "t": "2026-10-28T18:20:10+07:00",
      "k": "ticket",
      "ids": [
        "01"
      ],
      "act": "review"
    },
    {
      "t": "2026-10-28T18:20:46+07:00",
      "k": "ticket",
      "ids": [
        "02",
        "03",
        "04"
      ],
      "act": "start"
    },
    {
      "t": "2026-10-28T18:23:00+07:00",
      "k": "ticket",
      "ids": [
        "01"
      ],
      "act": "done",
      "tests": {
        "passed": 110,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T18:23:00+07:00",
      "k": "add",
      "key": "concerns",
      "n": 5
    },
    {
      "t": "2026-10-28T18:31:20+07:00",
      "k": "ticket",
      "ids": [
        "03"
      ],
      "act": "done",
      "tests": {
        "passed": 110,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T18:31:20+07:00",
      "k": "add",
      "key": "debt.placeholders",
      "n": 1
    },
    {
      "t": "2026-10-28T18:31:20+07:00",
      "k": "add",
      "key": "concerns",
      "n": 1
    },
    {
      "t": "2026-10-28T18:36:21+07:00",
      "k": "ticket",
      "ids": [
        "04"
      ],
      "act": "review"
    },
    {
      "t": "2026-10-28T18:36:21+07:00",
      "k": "ticket",
      "ids": [
        "05"
      ],
      "act": "start"
    },
    {
      "t": "2026-10-28T18:36:36+07:00",
      "k": "ticket",
      "ids": [
        "04"
      ],
      "act": "done",
      "tests": {
        "passed": 167,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T18:36:36+07:00",
      "k": "ticket",
      "ids": [
        "04"
      ],
      "act": "review"
    },
    {
      "t": "2026-10-28T18:36:36+07:00",
      "k": "add",
      "key": "concerns",
      "n": 2
    },
    {
      "t": "2026-10-28T18:37:42+07:00",
      "k": "ticket",
      "ids": [
        "04"
      ],
      "act": "done",
      "tests": {
        "passed": 167,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T18:37:42+07:00",
      "k": "add",
      "key": "concerns",
      "n": 3
    },
    {
      "t": "2026-10-28T18:43:06+07:00",
      "k": "ticket",
      "ids": [
        "02"
      ],
      "act": "done",
      "tests": {
        "passed": 185,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T18:43:07+07:00",
      "k": "add",
      "key": "concerns",
      "n": 4
    },
    {
      "t": "2026-10-28T18:43:07+07:00",
      "k": "add",
      "key": "debt.assumptions",
      "n": 1
    },
    {
      "t": "2026-10-28T18:43:07+07:00",
      "k": "ticket",
      "ids": [
        "07"
      ],
      "act": "start"
    },
    {
      "t": "2026-10-28T18:55:45+07:00",
      "k": "ticket",
      "ids": [
        "05"
      ],
      "act": "done",
      "tests": {
        "passed": 257,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T18:55:45+07:00",
      "k": "ticket",
      "ids": [
        "05"
      ],
      "act": "review"
    },
    {
      "t": "2026-10-28T18:55:45+07:00",
      "k": "add",
      "key": "concerns",
      "n": 4
    },
    {
      "t": "2026-10-28T18:55:45+07:00",
      "k": "add",
      "key": "debt.assumptions",
      "n": 1
    },
    {
      "t": "2026-10-28T18:55:45+07:00",
      "k": "ticket",
      "ids": [
        "06",
        "08"
      ],
      "act": "start"
    },
    {
      "t": "2026-10-28T18:57:37+07:00",
      "k": "ticket",
      "ids": [
        "07"
      ],
      "act": "done",
      "tests": {
        "passed": 257,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T18:57:37+07:00",
      "k": "add",
      "key": "concerns",
      "n": 3
    },
    {
      "t": "2026-10-28T18:57:37+07:00",
      "k": "ticket",
      "ids": [
        "09"
      ],
      "act": "start"
    },
    {
      "t": "2026-10-28T18:58:02+07:00",
      "k": "ticket",
      "ids": [
        "05"
      ],
      "act": "repair",
      "note": "в production без PAYOS_* TestProvider не активен, webhook не принимает тела с ключом тестового провайдера"
    },
    {
      "t": "2026-10-28T18:58:02+07:00",
      "k": "add",
      "key": "concerns",
      "n": 5
    },
    {
      "t": "2026-10-28T18:59:40+07:00",
      "k": "ticket",
      "ids": [
        "05"
      ],
      "act": "done",
      "tests": {
        "passed": 260,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T18:59:40+07:00",
      "k": "ticket",
      "ids": [
        "05"
      ],
      "act": "review"
    },
    {
      "t": "2026-10-28T19:00:22+07:00",
      "k": "ticket",
      "ids": [
        "05"
      ],
      "act": "done",
      "tests": {
        "passed": 260,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T19:00:22+07:00",
      "k": "add",
      "key": "concerns",
      "n": 1
    },
    {
      "t": "2026-10-28T19:05:43+07:00",
      "k": "ticket",
      "ids": [
        "06"
      ],
      "act": "done",
      "tests": {
        "passed": 334,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T19:05:43+07:00",
      "k": "add",
      "key": "concerns",
      "n": 4
    },
    {
      "t": "2026-10-28T19:05:43+07:00",
      "k": "add",
      "key": "debt.placeholders",
      "n": 1
    },
    {
      "t": "2026-10-28T19:05:43+07:00",
      "k": "ticket",
      "ids": [
        "10"
      ],
      "act": "start"
    },
    {
      "t": "2026-10-28T19:37:12+07:00",
      "k": "ticket",
      "ids": [
        "09"
      ],
      "act": "done",
      "tests": {
        "passed": 363,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T19:37:13+07:00",
      "k": "add",
      "key": "concerns",
      "n": 2
    },
    {
      "t": "2026-10-28T19:39:35+07:00",
      "k": "ticket",
      "ids": [
        "08"
      ],
      "act": "done",
      "tests": {
        "passed": 363,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T19:39:35+07:00",
      "k": "add",
      "key": "debt.placeholders",
      "n": 2
    },
    {
      "t": "2026-10-28T19:39:35+07:00",
      "k": "add",
      "key": "concerns",
      "n": 3
    },
    {
      "t": "2026-10-28T19:57:39+07:00",
      "k": "ticket",
      "ids": [
        "10"
      ],
      "act": "done",
      "tests": {
        "passed": 407,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T19:57:39+07:00",
      "k": "ticket",
      "ids": [
        "10"
      ],
      "act": "review"
    },
    {
      "t": "2026-10-28T19:57:39+07:00",
      "k": "add",
      "key": "concerns",
      "n": 4
    },
    {
      "t": "2026-10-28T19:57:39+07:00",
      "k": "ticket",
      "ids": [
        "11"
      ],
      "act": "start"
    },
    {
      "t": "2026-10-28T19:59:38+07:00",
      "k": "ticket",
      "ids": [
        "10"
      ],
      "act": "done",
      "tests": {
        "passed": 407,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T19:59:38+07:00",
      "k": "add",
      "key": "concerns",
      "n": 4
    },
    {
      "t": "2026-10-28T20:27:38+07:00",
      "k": "ticket",
      "ids": [
        "11"
      ],
      "act": "done",
      "tests": {
        "passed": 436,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T20:27:38+07:00",
      "k": "ticket",
      "ids": [
        "11"
      ],
      "act": "review"
    },
    {
      "t": "2026-10-28T20:27:38+07:00",
      "k": "add",
      "key": "concerns",
      "n": 5
    },
    {
      "t": "2026-10-28T20:27:39+07:00",
      "k": "ticket",
      "ids": [
        "12"
      ],
      "act": "start"
    },
    {
      "t": "2026-10-28T20:29:42+07:00",
      "k": "ticket",
      "ids": [
        "11"
      ],
      "act": "done",
      "tests": {
        "passed": 436,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T20:29:42+07:00",
      "k": "add",
      "key": "concerns",
      "n": 5
    },
    {
      "t": "2026-10-28T21:02:51+07:00",
      "k": "ticket",
      "ids": [
        "12"
      ],
      "act": "done",
      "tests": {
        "passed": 436,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T21:02:51+07:00",
      "k": "add",
      "key": "debt.placeholders",
      "n": 1
    },
    {
      "t": "2026-10-28T21:02:51+07:00",
      "k": "add",
      "key": "concerns",
      "n": 3
    },
    {
      "t": "2026-10-28T21:02:51+07:00",
      "k": "stage",
      "id": "review",
      "act": "start"
    },
    {
      "t": "2026-10-28T21:09:56+07:00",
      "k": "tickets",
      "n": 13
    },
    {
      "t": "2026-10-28T21:09:56+07:00",
      "k": "gate",
      "g": "G3",
      "ok": true,
      "problems": 0
    },
    {
      "t": "2026-10-28T21:09:57+07:00",
      "k": "add",
      "key": "report",
      "n": 27
    },
    {
      "t": "2026-10-28T21:09:57+07:00",
      "k": "ticket",
      "ids": [
        "F1"
      ],
      "act": "start"
    },
    {
      "t": "2026-10-28T21:30:40+07:00",
      "k": "ticket",
      "ids": [
        "F1"
      ],
      "act": "done",
      "tests": {
        "passed": 512,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T21:30:40+07:00",
      "k": "ticket",
      "ids": [
        "F1"
      ],
      "act": "review"
    },
    {
      "t": "2026-10-28T21:30:40+07:00",
      "k": "add",
      "key": "report",
      "n": 2
    },
    {
      "t": "2026-10-28T21:32:24+07:00",
      "k": "ticket",
      "ids": [
        "F1"
      ],
      "act": "done",
      "tests": {
        "passed": 512,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T21:32:24+07:00",
      "k": "stage",
      "id": "final",
      "act": "start"
    },
    {
      "t": "2026-10-28T22:01:23+07:00",
      "k": "tickets",
      "n": 14
    },
    {
      "t": "2026-10-28T22:01:23+07:00",
      "k": "gate",
      "g": "G3",
      "ok": true,
      "problems": 0
    },
    {
      "t": "2026-10-28T22:01:23+07:00",
      "k": "ticket",
      "ids": [
        "F2"
      ],
      "act": "start"
    },
    {
      "t": "2026-10-28T22:01:32+07:00",
      "k": "gate",
      "g": "G4",
      "ok": false,
      "checked": 52,
      "matched": 45
    },
    {
      "t": "2026-10-28T22:11:23+07:00",
      "k": "ticket",
      "ids": [
        "F2"
      ],
      "act": "repair",
      "note": "staff-scope.spec не зависит от времени суток; restrictionsText редактируется в админке"
    },
    {
      "t": "2026-10-28T22:13:23+07:00",
      "k": "ticket",
      "ids": [
        "F2"
      ],
      "act": "done",
      "tests": {
        "passed": 538,
        "failed": 0
      }
    },
    {
      "t": "2026-10-28T22:13:23+07:00",
      "k": "tests",
      "passed": 538,
      "failed": 0
    },
    {
      "t": "2026-10-28T22:13:23+07:00",
      "k": "add",
      "key": "debt.placeholders",
      "n": 1
    },
    {
      "t": "2026-10-28T22:14:29+07:00",
      "k": "finish",
      "result": "MVP «Аренда Байка»: Telegram Mini App, бот, режим менеджера и веб-админка по ТЗ §13; 538 тестов и 5 сквозных зелёные"
    }
  ],
  "reqList": [
    {
      "id": "R01",
      "text": "«нужно создать приложение по этому тз»",
      "status": "done"
    },
    {
      "id": "R02",
      "text": "«оно должно быть быстрое»",
      "status": "done"
    },
    {
      "id": "R03",
      "text": "«и удобное»",
      "status": "done"
    },
    {
      "id": "R04",
      "text": "«Используй для дизайна скилл /impeccable»",
      "status": "done"
    },
    {
      "id": "R05",
      "text": "«турист за 60 секунд выбирает байк, бронирует его на конкретные даты и оплачивает аренду, не выходя из Telegram»",
      "status": "done"
    },
    {
      "id": "R06",
      "text": "«Приложение работает на трёх языках: русском, английском и вьетнамском»",
      "status": "done"
    },
    {
      "id": "R07",
      "text": "«роль определяется по Telegram ID, отдельная регистрация с паролем не нужна»",
      "status": "done"
    },
    {
      "id": "R08",
      "text": "«Язык подставляется из language_code Telegram (ru → RU, vi → VI, остальное → EN)»",
      "status": "done"
    },
    {
      "id": "R09",
      "text": "«Даты выбираются один раз и сохраняются на всём пути»",
      "status": "done"
    },
    {
      "id": "R10",
      "text": "«Главный экран. Сверху сразу виден блок дат «Когда нужен байк?» с быстрыми кнопками»",
      "status": "done"
    },
    {
      "id": "R11",
      "text": "«каталог байков, доступных на эти даты, с итоговой ценой за весь период»",
      "status": "done"
    },
    {
      "id": "R12",
      "text": "«Карточка байка. Фото, характеристики, цена, итог за период, кнопка «Забронировать» внизу (Telegram MainButton)»",
      "status": "done"
    },
    {
      "id": "R13",
      "text": "«Оформление (один экран)» — даты, получение (самовывоз / доставка), опции, контакт через requestContact, документы, согласие",
      "status": "done"
    },
    {
      "id": "R14",
      "text": "«Оплата. Выбор способа и оплата внутри приложения» — экран «Бронь подтверждена» с номером, QR-кодом и «Как добраться»",
      "status": "done"
    },
    {
      "id": "R15",
      "text": "«Подтверждение в боте. Бот присылает сообщение с деталями брони… и напоминает за 24 часа и за 2 часа до выдачи»",
      "status": "done"
    },
    {
      "id": "R16",
      "text": "«Повторный клиент проходит шаги 2 → 3 → 5»",
      "status": "done"
    },
    {
      "id": "R17",
      "text": "«Быстрая аренда прямо сейчас»: кнопка «Нужен байк сейчас»",
      "status": "done"
    },
    {
      "id": "R18",
      "text": "«нижнее меню из 4 вкладок: Главная, Мои брони, Избранное, Профиль. Кнопка «Назад» — системная BackButton»",
      "status": "done"
    },
    {
      "id": "R19",
      "text": "«4.1 Онбординг (только при первом запуске)» с выбором языка",
      "status": "done"
    },
    {
      "id": "R20",
      "text": "«4.2 Главная» — приветствие, выбор города / точки, баннер, категории-чипы, «Популярные», «Все байки», фильтры",
      "status": "done"
    },
    {
      "id": "R21",
      "text": "«4.3 Каталог и фильтры» — карточка в списке, недоступные серые «Занят до 12.11», шторка фильтров, «Сбросить» и «Показать N байков»",
      "status": "done"
    },
    {
      "id": "R22",
      "text": "«4.4 Карточка байка» — галерея, рейтинг, плитки, тарифная сетка, что входит, условия, отзывы, нижняя панель",
      "status": "done"
    },
    {
      "id": "R23",
      "text": "«4.5 Оформление брони… Итоговая сумма с детализацией»",
      "status": "done"
    },
    {
      "id": "R24",
      "text": "«4.7 Мои брони» — вкладки, карточка с таймером, «Продлить», «Отменить», «Связаться с менеджером», «Сообщить о проблеме», отзыв",
      "status": "done"
    },
    {
      "id": "R25",
      "text": "«4.8 Избранное»",
      "status": "done"
    },
    {
      "id": "R26",
      "text": "«4.9 Профиль» — документы со статусом, язык, валюта, часовой пояс, промокоды, рефералка, поддержка",
      "status": "placeholder",
      "why": "MVP по §13 (ответ 1: «Ок» — MVP строго по ТЗ); промокоды и реферальная ссылка — этап 4"
    },
    {
      "id": "R27",
      "text": "«5.1 Календарь» — диапазон, быстрые кнопки, слоты 30 мин, отключённые даты, итог под календарём, UTC / Asia/Ho_Chi_Minh",
      "status": "done"
    },
    {
      "id": "R28",
      "text": "«5.2 Правила расчёта» — сутки 24 ч, опоздание, тарифы по длительности, сезонные коэффициенты, минимумы",
      "status": "done"
    },
    {
      "id": "R29",
      "text": "«5.3 Защита от двойной брони» — удержание 15 минут, транзакция с блокировкой, автоотмена, буфер 1 час",
      "status": "done"
    },
    {
      "id": "R30",
      "text": "«5.4 Статусы брони»",
      "status": "done"
    },
    {
      "id": "R31",
      "text": "«5.5 Продление»",
      "status": "deferred",
      "why": "ответ 1: продление — этап 4 по §13"
    },
    {
      "id": "R32",
      "text": "«5.6 Отмена и возврат» — 100% / 50% / 0%",
      "status": "done"
    },
    {
      "id": "R33",
      "text": "«6.1 Способы оплаты» — VietQR, карта, USDT / TON, наличные",
      "status": "done"
    },
    {
      "id": "R34",
      "text": "«6.2 Требования к оплате» — VND, «≈», код заказа, статус в реальном времени, идемпотентный webhook, недоплата → «Проблема», чек",
      "status": "done"
    },
    {
      "id": "R35",
      "text": "«6.3 Депозит»",
      "status": "done"
    },
    {
      "id": "R36",
      "text": "«6.4 Возвраты»",
      "status": "done"
    },
    {
      "id": "R37",
      "text": "«7. Локализация RU / EN / VI» — i18n JSON, мгновенная смена, ICU-множественное число, форматы, контент админки на 3 языках",
      "status": "done"
    },
    {
      "id": "R38",
      "text": "«8.1 Админ-панель» — дашборд, шахматка, брони, парк, цены, точки, клиенты, промо, платежи, отчёты, настройки",
      "status": "done"
    },
    {
      "id": "R39",
      "text": "«8.2 Режим менеджера в Mini App» — выдачи/возвраты, сканер QR, фотоакт, ремонт",
      "status": "done"
    },
    {
      "id": "R40",
      "text": "«8.3 Уведомления бота» — таблица событий, inline-кнопка startapp=booking_<id>",
      "status": "done"
    },
    {
      "id": "R41",
      "text": "«9. Дизайн и UI» — референсы, светлая/тёмная тема по Telegram, сетка 4 pt, 44 pt, safe area, HapticFeedback, скелетоны, анимации 150–250 мс",
      "status": "done"
    },
    {
      "id": "R42",
      "text": "«10.1 Рекомендуемый стек» — React + TS + Vite, @telegram-apps/sdk, TanStack Query, i18next, Tailwind; бэкенд; PostgreSQL; Redis",
      "status": "done"
    },
    {
      "id": "R43",
      "text": "«10.2 Модель данных»",
      "status": "done"
    },
    {
      "id": "R44",
      "text": "«10.3 Основные эндпоинты API» — проверка initData HMAC-SHA256",
      "status": "done"
    },
    {
      "id": "R45",
      "text": "«11.1 Документы клиента» — паспорт, права, IDP, категория прав влияет на каталог, предупреждение, договор PDF",
      "status": "done"
    },
    {
      "id": "R46",
      "text": "«11.2 Защита данных» — приватный бакет, ссылки до 10 мин, автоудаление 90 дней",
      "status": "done"
    },
    {
      "id": "R47",
      "text": "«11.3 Безопасность приложения» — нет доступа к чужим броням, подписи webhook, rate limit, журнал действий, бэкапы",
      "status": "done"
    },
    {
      "id": "R48",
      "text": "«12. Нефункциональные требования» — ≤ 2 сек, ≤ 250 КБ gzip, WebP/AVIF, от 360 px, темы",
      "status": "done"
    },
    {
      "id": "R49",
      "text": "«Тестирование — Unit-тесты расчёта цены и доступности (покрытие ≥ 80%), e2e основного сценария, тест параллельных броней»",
      "status": "done"
    },
    {
      "id": "R50",
      "text": "«Аналитика — События воронки»",
      "status": "done"
    },
    {
      "id": "R51",
      "text": "«Документация — README, OpenAPI-спецификация, инструкция по деплою, инструкция для менеджера на 3 языках»",
      "status": "done"
    },
    {
      "id": "R52",
      "text": "«MVP — это каталог, бронирование на даты, оплата VietQR и наличными, три языка, уведомления бота и базовая админка; остальное добавляется во втором этапе»",
      "status": "done"
    },
    {
      "id": "R53",
      "text": "«13.2 Критерии приёмки MVP»",
      "status": "done"
    },
    {
      "id": "R54i",
      "text": "(подразумевается) реальный парк, цены, фото и тексты правил — данных нет, нужны видимые заглушки, редактируемые в админке",
      "status": "done"
    },
    {
      "id": "R55i",
      "text": "(подразумевается) аккаунты платёжных провайдеров и токен бота — нужны для живой оплаты и уведомлений",
      "status": "done"
    },
    {
      "id": "R56i",
      "text": "(подразумевается) запуск: как заказчик поднимет и проверит систему без деплоя",
      "status": "done"
    }
  ],
  "gates": {
    "G1": {
      "ok": false,
      "at": "2026-10-28T17:41:06+07:00",
      "open": 55,
      "total": 56
    },
    "G2": {
      "ok": true,
      "at": "2026-10-28T17:46:25+07:00",
      "found": 37,
      "fixed": 36,
      "deferred": 1
    },
    "G3": {
      "ok": true,
      "at": "2026-10-28T22:01:23+07:00",
      "problems": 0
    },
    "G4": {
      "ok": false,
      "at": "2026-10-28T22:01:32+07:00",
      "checked": 52,
      "matched": 45
    }
  },
  "result": "MVP «Аренда Байка»: Telegram Mini App, бот, режим менеджера и веб-админка по ТЗ §13; 538 тестов и 5 сквозных зелёные",
  "report": [
    "Оплата, пришедшая после отмены брони, записывается как полученная без записи «к возврату» — в сверке её не видно, только по алерту",
    "После возврата излишка бронь остаётся помеченной как переплата",
    "Удержания из депозита не уменьшают сумму, доступную к возврату",
    "Защита от двойного возврата и лимит 10 броней в минуту работают в пределах одного сервера; при двух серверах — нет",
    "Повторное нажатие «Наличные» у менеджера создаёт второй платёж",
    "Номер заказа в payOS повторяется после 100 попыток оплаты одной брони",
    "Две одновременные брони модели с одним байком на разные даты могут дать ложное «Байк занят»",
    "Менеджеру в карточке брони в админке видны суммы и платежи (по ТЗ раздел платежей ему закрыт)",
    "CORS открыт для любого адреса — в production стоит ограничить адресами Mini App и админки",
    "Загрузка документа в S3 не ограничена по размеру (лимит действует только в локальном хранилище)",
    "Выход из админки стирает cookie, но токен действует ещё до 12 часов",
    "Клиент «с улицы» не получает сообщений бота",
    "«Нужен байк сейчас» открывает каталог, а не сразу оформление",
    "Договор PDF можно скачать, но кнопки «подтверждаю» в приложении нет",
    "На онбординге контур байка вместо фото",
    "Скачивание .ics и договора в мобильном Telegram может не сработать — нужна проверка на телефоне",
    "После истечения сессии (24 ч) нужно переоткрыть приложение — «Повторить» не помогает",
    "Фото актов уходят с камеры без сжатия",
    "Шрифт Manrope грузится с Google Fonts; масштабирование страницы запрещено",
    "Адрес доставки уходит строкой с координатами — отдельных полей в API нет",
    "Названия «Bike Rental» / «Thuê Xe Máy» — допущение, нужно согласие",
    "Экраны EN/VI, сканер QR и вёрстка админки не проверены на реальном Telegram и в браузере вручную",
    "Нагрузочный сценарий k6 не запускался",
    "Инструкция восстановления берёт переменные из оболочки — нужно загрузить .env",
    "README не говорит, что перед e2e нужно ",
    "openapi.json собирают два генератора с разными настройками",
    "Курсы, сохранённые вручную в админке, перезаписывает ежедневное обновление",
    "Цены в шторке дат и в режиме менеджера пока без «≈ ₽/$»",
    "Для сбоя задач уведомлений администратор получит два одинаковых алерта"
  ]
}
