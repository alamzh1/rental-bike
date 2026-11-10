import { useEffect, useState } from 'react';
import { useLogout } from '@refinedev/core';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, Menu, TriangleAlert } from 'lucide-react';
import type { Lang } from '@rental/shared';
import { cn, Icon, Sheet } from '@rental/ui';
import { PointSwitcher } from './PointSwitcher';
import { SECTION_NAV, splitNav } from './sections';
import { langToSync, markLangSynced, setLang } from './i18n';
import { api } from './providers';
import { insideTelegram } from './telegram';
import { useMe } from './ui';

const LANGS: Lang[] = ['ru', 'en', 'vi'];
const TAB = 'flex h-full min-h-[56px] flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-center text-[12px] font-bold leading-[14px] transition-colors duration-fast ease-out';

/** Каркас: тёмная «стойка» меню слева (десктоп) или сверху (телефон), плашка демо-данных, содержимое раздела. */
export function Layout() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const { mutate: logout } = useLogout();
  const nav = SECTION_NAV.filter((n) => me.sections.includes(n.section));
  const { primary, more } = splitNav(nav);
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const inMore = more.some((n) => pathname === n.path || pathname.startsWith(`${n.path}/`));
  useEffect(() => setMoreOpen(false), [pathname]);
  // Бот пишет сотруднику на языке админки. Здесь сессия уже есть, в том числе после выбора языка на странице входа
  useEffect(() => {
    const lang = langToSync();
    if (lang) api.post('/admin/auth/lang', { lang }).then(markLangSynced, () => undefined);
  }, [i18n.language]);

  const langSwitch = (
    <div role="group" aria-label={t('admin.nav.language')} className="flex gap-1">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={i18n.language === l}
          className={cn('h-control-sm min-w-control-sm rounded-sm px-2 text-caption font-bold uppercase transition-colors duration-fast', i18n.language === l ? 'bg-nav-border text-on-nav' : 'text-nav-icon hover:text-on-nav')}
        >
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:rounded-sm focus:bg-inverse focus:px-4 focus:py-2 focus:text-on-inverse">
        {t('admin.skipToContent')}
      </a>

      {/* Десктоп: меню слева на всю высоту */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-nav text-on-nav lg:flex">
        <div className="flex items-center gap-3 px-5 pb-4 pt-6">
          <img src="/favicon.svg" alt="" width={36} height={36} className="flex-none rounded-lg" />
          <div className="min-w-0">
            <p className="text-headline">{t('common.appName')}</p>
            <p className="text-caption text-nav-icon">{t('admin.appName')}</p>
          </div>
        </div>
        <nav aria-label={t('admin.nav.label')} className="flex-1 overflow-y-auto px-3">
          <ul className="flex flex-col gap-0.5">
            {nav.map((n) => (
              <li key={n.section}>
                <NavLink
                  to={n.path}
                  end={n.path === '/'}
                  className={({ isActive }) => cn('flex h-control-md items-center gap-3 rounded-sm px-3 text-body transition-colors duration-fast ease-out', isActive ? 'bg-nav-border text-on-nav font-bold' : 'text-nav-icon hover:text-on-nav')}
                >
                  <Icon icon={n.icon} size={20} />
                  {t(`admin.nav.${n.section}`)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-3 border-t border-nav-border px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-body-strong">{me.name}</p>
            <p className="text-caption text-nav-icon">{t(`admin.roles.${me.role}`)}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            {langSwitch}
            <button type="button" hidden={insideTelegram()} onClick={() => logout()} className="flex h-control-sm items-center gap-2 rounded-sm px-2 text-caption font-bold text-nav-icon hover:text-on-nav">
              <Icon icon={LogOut} size={16} />
              {t('admin.nav.logout')}
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {me.hasDemoData && (
          <div role="status" className="flex items-start gap-3 bg-warning-soft px-4 py-3 text-warning lg:px-8">
            <Icon icon={TriangleAlert} size={20} />
            <p className="text-body">
              <strong className="font-bold">{t('admin.demo.banner')}.</strong> <span>{t(me.role === 'OWNER' ? 'admin.demo.textOwner' : 'admin.demo.text')}</span>
            </p>
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 pb-[calc(env(safe-area-inset-bottom)+theme(spacing.30))] pt-[calc(env(safe-area-inset-top)+theme(spacing.6))] lg:px-8 lg:py-8">
          <PointSwitcher />
          <Outlet />
        </main>
      </div>

      {/* Телефон и планшет: нижнее меню под большим пальцем, остальное — в «Ещё» */}
      <nav aria-label={t('admin.nav.label')} className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+theme(spacing.3))] z-nav mx-auto w-[calc(100%-theme(spacing.6))] max-w-[520px] lg:hidden">
        <ul className="flex items-stretch gap-1 rounded-xl border border-nav-border bg-nav p-1.5 shadow-nav">
          {primary.map((n) => (
            <li key={n.section} className="min-w-0 flex-auto">
              <NavLink to={n.path} end={n.path === '/'} className={({ isActive }) => cn(TAB, isActive ? 'bg-accent text-on-accent' : 'text-nav-icon')}>
                <Icon icon={n.icon} size={20} />
                <span>{t(`admin.navShort.${n.section}`)}</span>
              </NavLink>
            </li>
          ))}
          <li className="min-w-0 flex-auto">
            <button type="button" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)} className={cn(TAB, 'w-full', inMore ? 'bg-accent text-on-accent' : 'text-nav-icon')}>
              <Icon icon={Menu} size={20} />
              <span>{t('admin.nav.more')}</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t('admin.nav.more')} closeLabel={t('admin.common.close')} className="lg:hidden">
        <div className="flex flex-col gap-5 pb-2">
          {more.length > 0 && (
            <ul className="grid grid-cols-3 gap-2">
              {more.map((n) => (
                <li key={n.section}>
                  <NavLink to={n.path} className={({ isActive }) => cn('flex h-full min-h-[84px] flex-col items-center justify-center gap-2 rounded-md px-1 py-2 text-center text-caption font-bold', isActive ? 'bg-inverse text-on-inverse' : 'bg-surface text-ink')}>
                    <Icon icon={n.icon} size={24} />
                    <span className="break-words">{t(`admin.nav.${n.section}`)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-body-strong">{t('admin.nav.language')}</span>
            <div role="group" aria-label={t('admin.nav.language')} className="flex gap-1">
              {LANGS.map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={i18n.language === l} className={cn('h-control-md min-w-control-md rounded-sm px-2 text-caption font-bold uppercase', i18n.language === l ? 'bg-inverse text-on-inverse' : 'bg-surface text-ink')}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <div className="min-w-0">
              <p className="truncate text-body-strong">{me.name}</p>
              <p className="text-caption text-ink-muted">{t(`admin.roles.${me.role}`)}</p>
            </div>
            {!insideTelegram() && (
              <button type="button" onClick={() => logout()} className="flex h-control-md flex-none items-center gap-2 rounded-md bg-surface px-4 text-button text-ink">
                <Icon icon={LogOut} size={20} />
                {t('admin.nav.logout')}
              </button>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
