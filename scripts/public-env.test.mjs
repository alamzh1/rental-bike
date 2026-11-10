import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hostsFor, httpsOnlyMiddleware, pageCsp, publicEnvPatch, publicEnvProblems, tunnelConfig, updateEnvText } from './public-env.mjs';

const ready = {
  DEV_AUTH: 'local',
  JWT_SECRET: 'a',
  ADMIN_SESSION_SECRET: 'b',
  FILES_SIGNING_SECRET: 'c',
  PAYMENT_KEYS_SECRET: 'd',
  MINIAPP_URL: 'https://app.example.com',
  ADMIN_URL: 'https://admin.example.com',
  API_PUBLIC_URL: 'https://app.example.com',
  TELEGRAM_BOT_TOKEN: 't',
  TELEGRAM_BOT_USERNAME: 'u',
};

test('готовые настройки пропускаются', () => assert.deepEqual(publicEnvProblems(ready), []));

test('тестовый вход не выходит в интернет', () => {
  for (const DEV_AUTH of ['1', '', undefined]) assert.match(publicEnvProblems({ ...ready, DEV_AUTH }).join(), /DEV_AUTH/);
  assert.deepEqual(publicEnvProblems({ ...ready, DEV_AUTH: '0' }), []);
});

test('стандартные секреты и временные адреса отклоняются', () => {
  assert.match(publicEnvProblems({ ...ready, JWT_SECRET: 'dev-only-jwt-secret' }).join(), /JWT_SECRET/);
  assert.match(publicEnvProblems({ ...ready, ADMIN_SESSION_SECRET: '' }).join(), /ADMIN_SESSION_SECRET/);
  assert.match(publicEnvProblems({ ...ready, MINIAPP_URL: 'https://x.trycloudflare.com' }).join(), /MINIAPP_URL/);
  assert.match(publicEnvProblems({ ...ready, API_PUBLIC_URL: 'http://localhost:3000' }).join(), /API_PUBLIC_URL/);
});

test('патч исправляет вход, адреса и секреты, но не трогает заданные секреты', () => {
  const p = publicEnvPatch({ DEV_AUTH: '1', JWT_SECRET: 'keep', ADMIN_SESSION_SECRET: 'dev-only-admin-secret' }, hostsFor('Example.com'));
  assert.equal(p.DEV_AUTH, 'local');
  assert.equal(p.MINIAPP_URL, 'https://app.example.com');
  assert.equal(p.ADMIN_URL, 'https://admin.example.com');
  assert.equal(p.JWT_SECRET, undefined);
  assert.match(p.ADMIN_SESSION_SECRET, /^[0-9a-f]{64}$/);
  assert.match(p.FILES_SIGNING_SECRET, /^[0-9a-f]{64}$/);
  assert.deepEqual(publicEnvProblems({ ...ready, ...publicEnvPatch(ready) }), []);
});

test('домен проверяется', () => {
  assert.throws(() => hostsFor('localhost'));
  assert.throws(() => hostsFor('a b.com'));
  assert.throws(() => hostsFor('https://example.com'));
});

test('.env: замена и дописывание, комментарии остаются, $ в значении не ломает замену', () => {
  assert.equal(updateEnvText('# c\nA=1\nB=2', { A: '$&x', C: '3' }), '# c\nA=$&x\nB=2\nC=3\n');
});

test('туннель: документация API закрыта раньше общего правила, в конце — заглушка', () => {
  const c = tunnelConfig({ tunnelId: 'id', credentialsFile: '/c.json', hosts: hostsFor('example.com') });
  assert.ok(c.indexOf('^/api/docs') < c.indexOf('localhost:4173'));
  assert.match(c.trim().split('\n').at(-1), /http_status:404/);
});

test('http уводится на https, https получает HSTS, локальный запрос не трогаем', () => {
  const run = (proto) => {
    const out = { headers: {}, nexted: false };
    const res = { writeHead: (code, h) => Object.assign(out, { code, h }), end() {}, setHeader: (k, v) => (out.headers[k] = v) };
    httpsOnlyMiddleware({ headers: { 'x-forwarded-proto': proto, host: 'admin.example.com' }, url: '/login?x=1' }, res, () => (out.nexted = true));
    return out;
  };
  const http = run('http');
  assert.equal(http.code, 301);
  assert.equal(http.h.Location, 'https://admin.example.com/login?x=1');
  assert.equal(http.nexted, false);
  assert.ok(run('https').headers['Strict-Transport-Security']);
  assert.equal(run(undefined).nexted, true);
  assert.deepEqual(run(undefined).headers, {});
});

test('CSP разрешает встроенный скрипт только по хешу и не трогает скрипты с src', () => {
  const csp = pageCsp('<script>a()</script><script type="module" src="/x.js"></script>');
  assert.equal((csp.match(/sha256-/g) ?? []).length, 1);
  assert.doesNotMatch(csp.split(';')[1], /unsafe-inline/);
  assert.match(csp, /frame-ancestors 'self' https:\/\/\*\.telegram\.org/);
});

