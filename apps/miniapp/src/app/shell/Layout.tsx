import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Badge, IconButton, cn } from '@rental/ui';
import { useApp } from '../context';
import { TabBar } from './TabBar';
import { isTabRoot } from './tabs';

/** Назад по истории; если экран открыт ссылкой бота первым — на главную. */
function useGoBack() {
  const navigate = useNavigate();
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/', { replace: true });
  };
}

/** Оболочка: колонка до 480px, safe area Telegram, меню на вкладках, системная «Назад» на остальных. */
export function Layout() {
  const { platform, mocked, role } = useApp();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const tab = isTabRoot(pathname);
  const goBack = useGoBack();
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  const back = platform.backButton;

  useEffect(() => {
    if (!back) return;
    if (tab) {
      back.hide();
      return;
    }
    back.show();
    return back.onClick(() => goBackRef.current());
  }, [back, tab]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const browser = platform.kind === 'browser';
  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col pt-[var(--safe-top)] pr-[var(--safe-right)] pl-[var(--safe-left)]">
      {browser && (
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          {tab ? <span /> : <IconButton icon={ArrowLeft} label={t('common.actions.back')} onClick={goBack} />}
          {mocked && <Badge tone="warning">{t('common.dev.banner', { role })}</Badge>}
        </div>
      )}
      <main
        className={cn(
          'flex flex-1 flex-col',
          tab
            ? 'pb-[calc(var(--safe-bottom)+theme(spacing.tabbar-height)+theme(spacing.12))]'
            : 'pb-[calc(var(--safe-bottom)+theme(spacing.4))]',
        )}
      >
        <Outlet />
      </main>
      {tab && <TabBar />}
    </div>
  );
}
