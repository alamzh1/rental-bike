import { expect, test, type Page } from '@playwright/test';
import { tx, txPrefix } from './support';

// Истории 2 и 63, §13.2 п.1: открытие → даты → карточка → оформление → оплата (тестовый провайдер VietQR)
// → «Бронь подтверждена». Новый клиент ≤ 60 с, повторный ≤ 30 с. Время — от page.goto до экрана подтверждения.
// Нажатие «Тест: оплатить за клиента» имитирует перевод из банка; подтверждение приходит само (опрос статуса).

const NEW_CLIENT_LIMIT_MS = 60_000;
const RETURNING_CLIENT_LIMIT_MS = 30_000;

test.describe.configure({ mode: 'serial' });

async function pickBikeAndPay(page: Page, opts: { phone?: string }) {
  const ru = 'ru' as const;
  // Даты: быстрая кнопка «3 дня» на главной
  await page.getByRole('group', { name: tx(ru, 'dates.quick.label') }).getByRole('button', { name: tx(ru, 'dates.quick.days3') }).click();
  await expect(page.getByRole('button', { name: /3 дня ·/ })).toBeVisible();
  // Карточка: первая модель в «Все байки», у которой есть цена за срок
  const grid = page.locator('section[aria-labelledby="all-title"]');
  await grid.locator('article').filter({ has: page.getByRole('button', { name: tx(ru, 'catalog.card.book') }) }).first().locator('a[data-allow-truncate]').click();
  await page.getByRole('button', { name: new RegExp(`^${txPrefix(ru, 'bike.action.book')}`) }).click();
  // Оформление
  await expect(page.getByRole('heading', { level: 1, name: tx(ru, 'checkout.title') })).toBeVisible();
  // Документы — раньше всего остального: без них кнопка оплаты закрыта
  if (opts.phone) {
    await expect(page.getByRole('alert').filter({ hasText: tx(ru, 'checkout.blocked.documents') })).toBeVisible();
    await page.getByRole('checkbox', { name: tx(ru, 'profile.documents.consent') }).check();
    const photo = { mimeType: 'image/png', buffer: Buffer.from('e2e-document') };
    await page.getByLabel(tx(ru, 'profile.documents.type.PASSPORT'), { exact: true }).setInputFiles({ name: 'passport.png', ...photo });
    await expect(page.getByText(tx(ru, 'profile.documents.docStatus.UPLOADED')).first()).toBeVisible();
    await page.getByLabel(tx(ru, 'profile.documents.type.LICENSE'), { exact: true }).setInputFiles({ name: 'license.png', ...photo });
    await expect(page.getByText(tx(ru, 'profile.documents.slot.ready'))).toBeVisible();
  }
  const phone = page.getByRole('textbox', { name: tx(ru, 'checkout.contact.phone') });
  if (opts.phone) await phone.fill(opts.phone);
  else await expect(phone).not.toHaveValue(''); // повторный: телефон подставлен из профиля
  await page.getByRole('checkbox', { name: new RegExp(tx(ru, 'checkout.consent.text')) }).check();
  await page.getByRole('button', { name: new RegExp(`^${txPrefix(ru, 'checkout.cta.pay')}`) }).click();
  // Оплата: QR → тестовый «перевод» → подтверждение без действий клиента
  await expect(page.getByRole('heading', { level: 1, name: tx(ru, 'payment.title') })).toBeVisible();
  await page.getByRole('button', { name: tx(ru, 'payment.devPay') }).click();
  await expect(page.getByText(tx(ru, 'bookings.confirmed.title'), { exact: true })).toBeVisible({ timeout: 20_000 });
}

test('новый клиент: открытие → «Бронь подтверждена» ≤ 60 с', async ({ page }) => {
  const started = Date.now();
  await page.goto('/?dev_user=client&lang=ru');
  // Первый экран — язык, затем онбординг
  await page.getByRole('button', { name: 'Русский' }).click();
  await page.getByRole('button', { name: tx('ru', 'onboarding.start') }).click();
  await pickBikeAndPay(page, { phone: '+84 912 345 678' });
  const elapsed = Date.now() - started;
  test.info().annotations.push({ type: 'duration', description: `новый клиент: ${(elapsed / 1000).toFixed(1)} с` });
  console.log(`[e2e] новый клиент: ${(elapsed / 1000).toFixed(1)} с`);
  expect(elapsed).toBeLessThanOrEqual(NEW_CLIENT_LIMIT_MS);
});

test('повторный клиент: главная → карточка → оплата ≤ 30 с, телефон и способ оплаты подставлены', async ({ page }) => {
  const started = Date.now();
  await page.goto('/?dev_user=client&lang=ru');
  await expect(page.getByRole('button', { name: tx('ru', 'onboarding.start') })).toHaveCount(0);
  await pickBikeAndPay(page, {});
  const elapsed = Date.now() - started;
  test.info().annotations.push({ type: 'duration', description: `повторный клиент: ${(elapsed / 1000).toFixed(1)} с` });
  console.log(`[e2e] повторный клиент: ${(elapsed / 1000).toFixed(1)} с`);
  expect(elapsed).toBeLessThanOrEqual(RETURNING_CLIENT_LIMIT_MS);
});
