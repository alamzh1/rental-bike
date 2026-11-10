import { useEffect, useRef, useState } from 'react';
import { useLogin } from '@refinedev/core';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { AdminAuthConfig } from '@rental/shared';
import { LANGS, type Lang } from '@rental/shared';
import { Button, Chip, ChipGroup, Skeleton } from '@rental/ui';
import { BotLogin } from './BotLogin';
import { setLang } from './i18n';
import { api, type LoginParams } from './providers';
import { insideTelegram } from './telegram';
import { Alert } from './ui';

/** Вход: через бота без номера телефона, запасной — Telegram Login Widget, тестовый — в dev. Язык выбирается до входа. */
export function Login() {
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const inTelegram = insideTelegram();
  const [config, setConfig] = useState<AdminAuthConfig | null>(null);
  const [error, setError] = useState<string | null>(params.get('expired') ? t('admin.login.expired') : null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [showWidget, setShowWidget] = useState(false);
  const { mutate: login, isLoading } = useLogin<LoginParams>();

  useEffect(() => {
    if (inTelegram) return;
    api
      .get<AdminAuthConfig>('/admin/auth/config')
      .then(setConfig)
      .catch(() => setConfig({ botUsername: null, devAuth: false }));
  }, []);

  const submit = (p: LoginParams) =>
    login(p, {
      onSuccess: (r) => {
        if (!r.success) setError(r.error?.name === 'FORBIDDEN' ? t('admin.login.forbidden') : t('admin.login.failed'));
      },
    });

  // Возврат от виджета: подпись проверяет API, данные сразу убираются из адреса и истории
  useEffect(() => {
    if (!params.get('hash') || !params.get('id')) return;
    const data = Object.fromEntries(params.entries());
    window.history.replaceState(null, '', '/login');
    submit({ mode: 'widget', data });
  }, []);

  useEffect(() => {
    const host = widgetRef.current;
    if (!config?.botUsername || !host || !showWidget) return;
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.async = true;
    s.dataset.telegramLogin = config.botUsername;
    s.dataset.size = 'large';
    s.dataset.radius = '12';
    // Telegram вернёт на эту страницу с подписанными данными. data-onauth не подходит: виджет исполняет его через eval, а CSP это запрещает
    s.dataset.authUrl = `${window.location.origin}/login`;
    s.dataset.requestAccess = 'write';
    host.replaceChildren(s);
    return () => host.replaceChildren();
    // Виджет пересоздаётся только при смене бота, а не на каждый рендер
  }, [config?.botUsername, showWidget]);

  // Внутри Telegram вход уже прошёл по подписи: сюда попадают только без доступа или с устаревшей подписью
  if (inTelegram) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface px-4 py-12">
        <div className="w-full max-w-[420px] rounded-xl border border-line bg-surface-raised p-6">
          <h1 className="text-title-2 text-balance">{t('common.appName')}</h1>
          <div className="mt-4">
            <Alert>{t(params.get('expired') ? 'admin.login.telegramReopen' : 'admin.login.telegramDenied')}</Alert>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-[420px] rounded-xl border border-line bg-surface-raised p-6 sm:p-8">
        <ChipGroup label={t('admin.nav.language')} className="mb-6">
          {LANGS.map((l: Lang) => (
            <Chip key={l} variant="option" selected={i18n.language === l} onClick={() => setLang(l)} lang={l}>
              {t(`common.languages.${l}`)}
            </Chip>
          ))}
        </ChipGroup>
        <p className="text-caption text-ink-muted">{t('common.appName')}</p>
        <h1 className="mt-1 text-title-1 text-balance">{t('admin.login.title')}</h1>
        <p className="mt-2 text-body text-ink-muted">{t('admin.login.text')}</p>

        <div className="mt-6 flex min-h-[48px] flex-col gap-4">
          {error && <Alert>{error}</Alert>}
          {!config ? (
            <Skeleton className="h-12 w-60" />
          ) : config.botUsername ? (
            <>
              <BotLogin onConfirmed={() => submit({ mode: 'session' })} />
              {showWidget ? (
                <div className="flex flex-col gap-2">
                  <p className="text-caption text-ink-muted">{t('admin.login.widgetHint')}</p>
                  <div ref={widgetRef} aria-busy={isLoading || undefined} />
                </div>
              ) : (
                <button type="button" className="self-start text-caption text-accent-text underline-offset-4 hover:underline" onClick={() => setShowWidget(true)}>
                  {t('admin.login.otherWay')}
                </button>
              )}
            </>
          ) : (
            <Alert tone="warning">{t('admin.login.notConfigured')}</Alert>
          )}
        </div>

        {config?.devAuth && (
          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-headline">{t('admin.login.devTitle')}</h2>
            <p className="mt-1 text-caption text-ink-muted">{t('admin.login.devText')}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button variant="inverse" loading={isLoading} onClick={() => submit({ mode: 'dev', role: 'admin' })}>
                {t('admin.login.devAdmin')}
              </Button>
              <Button variant="secondary" loading={isLoading} onClick={() => submit({ mode: 'dev', role: 'manager' })}>
                {t('admin.login.devManager')}
              </Button>
              <Button variant="secondary" loading={isLoading} onClick={() => submit({ mode: 'dev', role: 'owner' })}>
                {t('admin.login.devOwner')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
