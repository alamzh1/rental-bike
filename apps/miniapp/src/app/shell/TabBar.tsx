import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon, cn } from '@rental/ui';
import { useHaptic } from '../context';
import { TABS } from './tabs';

/** Плавающее тёмное меню: активная вкладка — пилюля accent с подписью, остальные — иконки с aria-label. */
export function TabBar() {
  const { t } = useTranslation();
  const haptic = useHaptic();
  return (
    <nav
      aria-label={t('common.nav.label')}
      className="fixed inset-x-0 bottom-[calc(var(--safe-bottom)+theme(spacing.3))] z-nav mx-auto w-[calc(100%-theme(spacing.6))] max-w-[calc(theme(maxWidth.app)-theme(spacing.6))]"
    >
      <ul className="m-0 flex h-tabbar-height list-none items-center justify-between gap-1 rounded-xl border border-nav-border bg-nav p-2 shadow-nav">
        {TABS.map((tab) => (
          <li key={tab.key} className="flex">
            <NavLink
              to={tab.path}
              end
              onClick={() => haptic.selection()}
              aria-label={t(`common.nav.${tab.key}`)}
              className={({ isActive }) =>
                cn(
                  'flex h-12 min-w-12 items-center justify-center gap-2 rounded-lg px-3 text-caption font-bold no-underline',
                  'transition-[background-color,color,padding] duration-base ease-out',
                  isActive ? 'bg-accent px-4 text-on-accent' : 'text-nav-icon active:text-on-nav',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon icon={tab.icon} size={24} />
                  {isActive && <span className="animate-fade-in whitespace-nowrap">{t(`common.nav.${tab.key}`)}</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
