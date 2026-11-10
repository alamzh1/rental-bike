import { describe, expect, it } from 'vitest';
import { ADMIN_SECTIONS, canCallAdminApi, canOpenSection, canSeeMoney } from '../src/index.js';

// История 84: администратор видит всё; менеджер — брони, шахматку и парк своей точки без цен, настроек и платежей.
describe('роли админки', () => {
  it('администратор открывает все разделы и все сегменты API', () => {
    for (const s of ADMIN_SECTIONS) expect(canOpenSection('ADMIN', s)).toBe(true);
    for (const seg of ['settings', 'payments', 'tariffs', 'anything-new']) expect(canCallAdminApi('ADMIN', seg)).toBe(true);
  });

  it('менеджер: брони, шахматка, парк — да; цены, настройки, платежи, тексты, баннер, журнал — нет', () => {
    const open = ADMIN_SECTIONS.filter((s) => canOpenSection('MANAGER', s));
    expect(open.sort()).toEqual(['bookings', 'chess', 'dashboard', 'fleet', 'tracking']);
    for (const seg of ['bookings', 'chess', 'tracking', 'bikes', 'models']) expect(canCallAdminApi('MANAGER', seg)).toBe(true);
    for (const seg of ['settings', 'payments', 'tariffs', 'seasons', 'extras', 'audit', 'staff', 'banner', 'texts', 'finance', 'anything-new']) expect(canCallAdminApi('MANAGER', seg)).toBe(false);
  });

  it('владелец: всё о своей точке; общие настройки, тексты, баннер и журнал — нет', () => {
    const open = ADMIN_SECTIONS.filter((s) => canOpenSection('OWNER', s));
    expect(open.sort()).toEqual(['acts', 'bookings', 'chess', 'dashboard', 'finance', 'fleet', 'locations', 'payments', 'prices', 'tracking']);
    for (const seg of ['acts', 'finance', 'tariffs', 'seasons', 'extras', 'locations', 'payments', 'bikes', 'models']) expect(canCallAdminApi('OWNER', seg)).toBe(true);
    for (const seg of ['supervision', 'settings', 'audit', 'banner', 'texts', 'anything-new']) expect(canCallAdminApi('OWNER', seg)).toBe(false);
  });

  it('суммы видят владелец и администратор, менеджер и клиент — нет', () => {
    expect(['ADMIN', 'OWNER', 'MANAGER', 'CLIENT'].filter((r) => canSeeMoney(r as 'ADMIN'))).toEqual(['ADMIN', 'OWNER']);
  });

  it('клиент не открывает ничего', () => {
    for (const s of ADMIN_SECTIONS) expect(canOpenSection('CLIENT', s)).toBe(false);
    expect(canCallAdminApi('CLIENT', 'bookings')).toBe(false);
  });
});
