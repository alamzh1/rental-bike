import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { LANGS, apiUrl, clippedText, devToken, patchMe, tx, uploadDocuments, type Lang } from './support';

// Истории 11 и 5, §13.2 п.5 и п.10: каждый экран Mini App на 360 px в RU/EN/VI, светлая и тёмная тема —
// без обрезанного текста и горизонтальной прокрутки. Скриншоты — e2e/.output/screenshots/<lang>-<theme>-<screen>.png.

const shotsDir = fileURLToPath(new URL('../.output/screenshots/', import.meta.url));
mkdirSync(shotsDir, { recursive: true });

const THEMES = ['light', 'dark'] as const;
const DAY = 24 * 3600_000;

interface Fixture {
  modelId: string;
  from: string;
  to: string;
  pendingId: string;
  confirmedId: string;
}

/** Даты через неделю, 10:00–10:00 по Куинёну (UTC+7) — внутри часов точки. */
function futureRange(offsetDays: number, days: number) {
  const start = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + offsetDays, 3));
  return { from: start.toISOString(), to: new Date(start.getTime() + days * DAY).toISOString() };
}

async function prepare(request: APIRequestContext): Promise<Fixture> {
  const token = await devToken(request);
  const auth = { authorization: `Bearer ${token}` };
  await patchMe(request, token, { phone: '+84912345678', onboarded: true });
  await uploadDocuments(request, token);
  const models = (await (await request.get(apiUrl('/models'))).json()) as { items: { id: string }[] };
  const modelId = models.items[0]!.id;
  const book = async (offset: number) => {
    const r = futureRange(offset, 3);
    const res = await request.post(apiUrl('/bookings'), {
      headers: auth,
      data: { modelId, startAt: r.from, endAt: r.to, extras: [], paymentMethod: 'VIETQR', phone: '+84912345678', agreed: true },
    });
    expect(res.ok(), `POST /bookings ${res.status()} ${await res.text()}`).toBeTruthy();
    return ((await res.json()) as { id: string }).id;
  };
  const confirmedId = await book(14);
  const pay = (await (await request.post(apiUrl(`/bookings/${confirmedId}/pay`), { headers: auth })).json()) as { paymentId: string };
  expect((await request.post(apiUrl(`/dev/payments/${pay.paymentId}/pay`), { headers: auth, data: {} })).ok()).toBeTruthy();
  const pendingId = await book(20);
  const r = futureRange(7, 3);
  return { modelId, from: r.from, to: r.to, pendingId, confirmedId };
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // ленивые фото ниже первого экрана — догрузить до полностраничного снимка
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle');
  // анимации появления (≤ 250 мс) — до снимка
  await page.waitForTimeout(300);
}

test('проверка обрезки находит многоточие, срезанный текст и выход за край', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 400 });
  await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0;font:15px sans-serif">
    <button style="width:80px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Đặt xe ngay bây giờ</button>
    <p style="height:18px;overflow:hidden">Строка один<br>Строка два</p>
    <span style="display:inline-block;white-space:nowrap;margin-left:300px">Слишком длинная подпись</span>
    <a data-allow-truncate style="display:block;width:40px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Air Blade 125</a>
    <div style="display:flex;overflow-x:auto;width:360px"><span style="flex:none;width:500px">Лента прокручивается</span></div>
  </body>`);
  const found = await clippedText(page);
  expect(found.some((f) => f.includes('Đặt xe') && f.includes('ширина'))).toBe(true);
  expect(found.some((f) => f.includes('Строка один') && f.includes('высота'))).toBe(true);
  expect(found.some((f) => f.includes('Слишком длинная') && f.includes('за краем'))).toBe(true);
  expect(found.some((f) => f.includes('Air Blade'))).toBe(false); // исключение DESIGN.md: название модели в сетке
  expect(found.some((f) => f.includes('Лента'))).toBe(false); // горизонтальная лента — не обрезка
});

test('экраны RU/EN/VI × светлая/тёмная на 360 px без обрезки текста', async ({ page, request }) => {
  test.setTimeout(10 * 60_000);
  const fx = await prepare(request);
  const token = await devToken(request);
  const dates = `from=${encodeURIComponent(fx.from)}&to=${encodeURIComponent(fx.to)}`;
  const screens: { name: string; path: string; ready: (lang: Lang) => string; manager?: boolean; onboarding?: boolean }[] = [
    { name: 'onboarding', path: '/', ready: (l) => tx(l, 'onboarding.start'), onboarding: true },
    { name: 'home', path: '/', ready: (l) => tx(l, 'dates.title') },
    { name: 'dates', path: `/dates?model=${fx.modelId}`, ready: (l) => tx(l, 'dates.title') },
    { name: 'catalog', path: `/catalog?${dates}`, ready: (l) => tx(l, 'catalog.title') },
    { name: 'catalog-filters', path: `/catalog?${dates}&sheet=filters`, ready: (l) => tx(l, 'catalog.filters.title') },
    { name: 'bike', path: `/bikes/${fx.modelId}?${dates}`, ready: (l) => tx(l, 'bike.about') },
    { name: 'checkout', path: `/checkout/${fx.modelId}?${dates}`, ready: (l) => tx(l, 'checkout.title') },
    { name: 'payment', path: `/payment/${fx.pendingId}`, ready: (l) => tx(l, 'payment.title') },
    { name: 'confirmed', path: `/payment/${fx.confirmedId}`, ready: (l) => tx(l, 'bookings.confirmed.title') },
    { name: 'bookings', path: '/bookings', ready: (l) => tx(l, 'bookings.title') },
    { name: 'favorites', path: '/favorites', ready: (l) => tx(l, 'favorites.title') },
    { name: 'profile', path: '/profile', ready: (l) => tx(l, 'profile.language.title') },
    { name: 'documents', path: '/profile/documents', ready: (l) => tx(l, 'profile.documents.title') },
    { name: 'manager', path: '/manager', ready: (l) => tx(l, 'manager.title'), manager: true },
  ];
  const managerToken = await devToken(request, 'manager');
  const problems: string[] = [];

  for (const lang of LANGS) {
    await patchMe(request, token, { lang });
    await patchMe(request, managerToken, { lang });
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      for (const s of screens) {
        if (s.onboarding) await patchMe(request, token, { onboarded: false });
        const devUser = s.manager ? 'manager' : 'client';
        const sep = s.path.includes('?') ? '&' : '?';
        await page.goto(`${s.path}${sep}dev_user=${devUser}`);
        await expect(page.getByText(s.ready(lang), { exact: true }).first()).toBeVisible();
        await settle(page);
        for (const p of await clippedText(page)) problems.push(`${lang}/${theme}/${s.name}: ${p}`);
        await page.screenshot({ path: `${shotsDir}${lang}-${theme}-${s.name}.png`, fullPage: true });
        if (s.onboarding) await patchMe(request, token, { onboarded: true });
      }
    }
  }
  expect(problems, problems.join('\n')).toEqual([]);
});
