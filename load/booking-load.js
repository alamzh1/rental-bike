// Нагрузка (история 88): 500 одновременных пользователей листают каталог и считают цену,
// параллельно 50 броней в минуту. Пороги: каталог и расчёт цены p95 ≤ 300 мс.
//
// Запуск вручную (нужен k6: https://k6.io/docs/get-started/installation/):
//   pnpm load                                   — против LOAD_BASE_URL (по умолчанию http://localhost:3000)
//   LOAD_BASE_URL=https://staging.example pnpm load
// Брони создаются от синтетических клиентов с подписанным initData — нужен токен того же бота, что у API
// (LOAD_BOT_TOKEN, иначе TELEGRAM_BOT_TOKEN из .env). Без токена брони идут от одного тестового клиента
// DEV_AUTH (только dev) и упираются в лимит 10 броней/мин на пользователя — для проверки пропускной
// способности броней этого недостаточно. Платёжный провайдер на стенде должен быть тестовым:
// сценарий создаёт брони в «Ожидает оплаты», они снимаются сами через 15 минут.
// Синтетические клиенты документов не загружают: на стенде нужна настройка requireDocuments = false в таблице Setting.
// Никогда не запускайте против боевого API с настоящими клиентами.
import http from 'k6/http';
import crypto from 'k6/crypto';
import { check, group, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = (__ENV.LOAD_BASE_URL || 'http://localhost:3000').replace(/\/$/, '') + '/api';
const BOT_TOKEN = __ENV.LOAD_BOT_TOKEN || __ENV.TELEGRAM_BOT_TOKEN || '';
const DAY = 24 * 3600 * 1000;

const bookingsCreated = new Counter('bookings_created');
const bookingsTaken = new Counter('bookings_bike_taken');

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      exec: 'browse',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 500 },
        { duration: '5m', target: 500 },
        { duration: '30s', target: 0 },
      ],
    },
    book: {
      executor: 'constant-arrival-rate',
      exec: 'book',
      rate: 50,
      timeUnit: '1m',
      duration: '6m',
      startTime: '30s',
      preAllocatedVUs: 20,
      maxVUs: 60,
    },
  },
  thresholds: {
    'http_req_duration{name:catalog}': ['p(95)<300'],
    'http_req_duration{name:quote}': ['p(95)<300'],
    'http_req_duration{name:model}': ['p(95)<300'],
    'http_req_failed{scenario:browse}': ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

/** Подписанный initData синтетического пользователя (алгоритм Telegram WebApp). */
function initData(userId) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `load-${userId}-${Date.now()}`,
    user: JSON.stringify({ id: userId, first_name: 'Load', last_name: String(userId), language_code: 'en' }),
  };
  const dataCheck = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = crypto.hmac('sha256', 'WebAppData', BOT_TOKEN, 'binary');
  const hash = crypto.hmac("sha256", secret, dataCheck, "hex");
  return Object.keys(fields).map((k) => `${k}=${encodeURIComponent(fields[k])}`).concat(`hash=${hash}`).join('&');
}

function login(userId) {
  const body = BOT_TOKEN ? { initData: initData(userId) } : { devUser: 'client' };
  const res = http.post(`${BASE}/auth/telegram`, JSON.stringify(body), { headers: { 'content-type': 'application/json' }, tags: { name: 'auth' } });
  check(res, { 'auth 200': (r) => r.status === 200 || r.status === 201 });
  return res.json('token');
}

/** Случайный период 1–7 дней в ближайшие 300 дней, 10:00 по Куинёну (03:00 UTC). */
function randomRange() {
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 2 + Math.floor(Math.random() * 300), 3);
  return { from: new Date(start).toISOString(), to: new Date(start + (1 + Math.floor(Math.random() * 7)) * DAY).toISOString() };
}

export function setup() {
  const res = http.get(`${BASE}/models`);
  const ids = res.json('items').map((m) => m.id);
  if (!ids.length) throw new Error('каталог пуст: засейте БД (pnpm db:seed)');
  return { ids };
}

export function browse({ ids }) {
  const r = randomRange();
  const q = `from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`;
  const id = ids[Math.floor(Math.random() * ids.length)];
  group('catalog', () => {
    check(http.get(`${BASE}/home`, { tags: { name: 'catalog' } }), { 'home 200': (x) => x.status === 200 });
    check(http.get(`${BASE}/models?${q}`, { tags: { name: 'catalog' } }), { 'models 200': (x) => x.status === 200 });
    check(http.get(`${BASE}/models/${id}?${q}`, { tags: { name: 'model' } }), { 'model 200': (x) => x.status === 200 });
    const quote = http.post(`${BASE}/quotes`, JSON.stringify({ modelId: id, startAt: r.from, endAt: r.to, extras: [] }), {
      headers: { 'content-type': 'application/json' },
      tags: { name: 'quote' },
    });
    check(quote, { 'quote 2xx': (x) => x.status === 200 || x.status === 201 });
  });
  sleep(1 + Math.random() * 3);
}

export function book({ ids }) {
  const userId = 800000000 + Math.floor(Math.random() * 1000000);
  const token = login(userId);
  const r = randomRange();
  const id = ids[Math.floor(Math.random() * ids.length)];
  const res = http.post(
    `${BASE}/bookings`,
    JSON.stringify({ modelId: id, startAt: r.from, endAt: r.to, extras: [], paymentMethod: 'VIETQR', phone: '+84912345678', agreed: true }),
    { headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, tags: { name: 'booking' }, responseCallback: http.expectedStatuses(200, 201, 409) },
  );
  // 409 BIKE_TAKEN — штатный исход гонки за последний байк, не ошибка
  check(res, { 'booking created or BIKE_TAKEN': (x) => x.status === 200 || x.status === 201 || x.status === 409 });
  if (res.status === 409) bookingsTaken.add(1);
  else if (res.status < 300) bookingsCreated.add(1);
}
