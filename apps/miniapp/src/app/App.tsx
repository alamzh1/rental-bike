import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { detectLang } from '@rental/i18n';
import { AppProvider, useApp } from './context';
import { API_BASE, DEV_AUTH } from './env';
import { applyOverrides, getI18n } from './i18n';
import { detectPlatform, startParamToPath, type DetectedPlatform } from './platform';
import { startSession, type SessionStart } from './session/auth';
import { followTheme } from './theme';
import { openEvent } from './openEvent';
import { createRouter } from './router';
import { BootScreen } from './screens/BootScreen';
import { ErrorScreen } from './screens/ErrorScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { Onboarding } from './screens/Onboarding';
import { OpenViaBot } from './screens/OpenViaBot';

type Boot = { phase: 'loading' } | { phase: 'done'; env: DetectedPlatform; result: SessionStart };

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

/** Старт: окружение → тема → язык → вход → онбординг или маршруты. */
export function App() {
  const [boot, setBoot] = useState<Boot>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [i18n] = useState(() => getI18n(detectLang(navigator.language)));

  useEffect(() => {
    let cancelled = false;
    let stopTheme = () => {};
    void (async () => {
      const env = await detectPlatform(DEV_AUTH);
      stopTheme = followTheme(env.platform);
      if (env.platform?.user?.languageCode) getI18n(detectLang(env.platform.user.languageCode));
      const result = await startSession({
        mode: env.mode,
        initData: env.platform?.initData,
        fetch: (input, init) => fetch(input, init),
        apiBase: API_BASE,
        allowMock: DEV_AUTH,
        mockRole: env.devRole,
      });
      if (result.status === 'ready') getI18n(result.session.user.lang);
      env.platform?.ready();
      if (!cancelled) setBoot({ phase: 'done', env, result });
    })();
    return () => {
      cancelled = true;
      stopTheme();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setBoot({ phase: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <BootView boot={boot} retry={retry} />
    </I18nextProvider>
  );
}

function BootView({ boot, retry }: { boot: Boot; retry: () => void }) {
  const { t } = useTranslation();
  if (boot.phase === 'loading') return <BootScreen label={t('common.boot.loading')} />;
  const { env, result } = boot;
  if (result.status === 'outside' || !env.platform) return <OpenViaBot />;
  if (result.status === 'error') return <ErrorScreen code={result.code} onRetry={retry} />;
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider platform={env.platform} session={result.session} mocked={result.mocked}>
        <Ready startParam={env.platform.startParam} mocked={result.mocked} />
      </AppProvider>
    </QueryClientProvider>
  );
}

function Ready({ startParam, mocked }: { startParam: string | undefined; mocked: boolean }) {
  const { user, api } = useApp();
  const router = useMemo(() => createRouter(startParamToPath(startParam)), [startParam]);

  // Воронка (история 57): открытие приложения с источником startapp — один раз за запуск.
  const opened = useRef(false);
  useEffect(() => {
    if (mocked || opened.current) return;
    opened.current = true;
    void api.request('/events', { method: 'POST', json: openEvent(startParam) }).catch(() => undefined);
  }, [api, mocked, startParam]);

  // Правки текстов из админки поверх JSON; без API (мок) — только JSON.
  useEffect(() => {
    if (mocked) return;
    api.request<unknown>(`/i18n/${user.lang}`).then((d) => applyOverrides(user.lang, d), () => undefined);
  }, [api, mocked, user.lang]);

  if (!user.langChosen) return <LanguageScreen />;
  if (!user.onboarded) return <Onboarding />;
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
