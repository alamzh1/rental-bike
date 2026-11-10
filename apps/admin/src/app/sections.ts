import type { LucideIcon } from 'lucide-react';
import { Bike, CalendarRange, Camera, FileCheck, Users, ClipboardList, History, CircleDollarSign, Image, Languages, LayoutDashboard, MapPin, Radar, Settings, Tag, Wallet } from 'lucide-react';
import type { AdminSection } from '@rental/shared';

/** Порядок и иконки разделов меню. Путь раздела — `/<section>`, сводка — `/`. */
export const SECTION_NAV: { section: AdminSection; icon: LucideIcon; path: string }[] = [
  { section: 'dashboard', icon: LayoutDashboard, path: '/' },
  { section: 'owners', icon: Users, path: '/owners' },
  { section: 'bookings', icon: ClipboardList, path: '/bookings' },
  { section: 'chess', icon: CalendarRange, path: '/chess' },
  { section: 'tracking', icon: Radar, path: '/tracking' },
  { section: 'fleet', icon: Bike, path: '/fleet' },
  { section: 'acts', icon: Camera, path: '/acts' },
  { section: 'finance', icon: CircleDollarSign, path: '/finance' },
  { section: 'prices', icon: Tag, path: '/prices' },
  { section: 'locations', icon: MapPin, path: '/locations' },
  { section: 'payments', icon: Wallet, path: '/payments' },
  { section: 'documents', icon: FileCheck, path: '/documents' },
  { section: 'texts', icon: Languages, path: '/texts' },
  { section: 'settings', icon: Settings, path: '/settings' },
  { section: 'banner', icon: Image, path: '/banner' },
  { section: 'audit', icon: History, path: '/audit' },
];

/** Телефон: четыре раздела на каждый день — в нижнем меню, остальные — в «Ещё». */
const PRIMARY: readonly AdminSection[] = ['dashboard', 'bookings', 'tracking', 'chess'];

export function splitNav<T extends { section: AdminSection }>(items: T[]): { primary: T[]; more: T[] } {
  return { primary: items.filter((n) => PRIMARY.includes(n.section)), more: items.filter((n) => !PRIMARY.includes(n.section)) };
}
