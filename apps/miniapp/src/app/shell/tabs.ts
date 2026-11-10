import { CalendarCheck, Heart, House, UserRound, type LucideIcon } from 'lucide-react';

export interface TabDef {
  path: string;
  /** Ключ подписи common.nav.* */
  key: 'home' | 'bookings' | 'favorites' | 'profile';
  icon: LucideIcon;
}

/** Четыре вкладки нижнего меню. На их корнях — меню, на остальных маршрутах — системная «Назад». */
export const TABS: TabDef[] = [
  { path: '/', key: 'home', icon: House },
  { path: '/bookings', key: 'bookings', icon: CalendarCheck },
  { path: '/favorites', key: 'favorites', icon: Heart },
  { path: '/profile', key: 'profile', icon: UserRound },
];

export function isTabRoot(pathname: string): boolean {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return TABS.some((t) => t.path === clean);
}
