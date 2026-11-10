import { describe, expect, it } from 'vitest';
import { canOpenSection, type AdminSection } from '@rental/shared';
import { SECTION_NAV, splitNav } from '../src/app/sections';

const forRole = (role: 'ADMIN' | 'MANAGER') => splitNav(SECTION_NAV.filter((n) => canOpenSection(role, n.section)));
const names = (l: { section: AdminSection }[]) => l.map((n) => n.section);

describe('нижнее меню на телефоне', () => {
  it('администратор: четыре раздела внизу, остальные в «Ещё», ничего не теряется', () => {
    const { primary, more } = forRole('ADMIN');
    expect(names(primary)).toEqual(['dashboard', 'bookings', 'chess', 'tracking']);
    expect(primary.length + more.length).toBe(SECTION_NAV.length);
    expect(names(more)).toContain('finance');
  });

  it('менеджер не видит закрытых разделов', () => {
    const { primary, more } = forRole('MANAGER');
    expect(names(primary)).toEqual(['dashboard', 'bookings', 'chess', 'tracking']);
    expect(names(more)).toEqual(['fleet']);
  });
});
