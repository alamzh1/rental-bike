import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Lang, Role } from '@rental/shared';
import type { Platform } from './platform';
import { createApiClient, type ApiClient } from './session/api';
import { mockUpdateMe } from './session/mock';
import type { AuthResponse, MePatch, SessionUser } from './session/types';
import { getI18n } from './i18n';
import { API_BASE } from './env';

export interface AppContextValue {
  platform: Platform;
  /** Клиент API с Bearer-токеном сессии. Для экранов — через TanStack Query. */
  api: ApiClient;
  token: string;
  user: SessionUser;
  role: Role;
  /** Сессия из мока (DEV_AUTH, API ещё без /auth/telegram). */
  mocked: boolean;
  /** PATCH /me; язык меняется мгновенно, до ответа сервера. */
  updateMe(patch: MePatch): Promise<SessionUser>;
  setLang(lang: Lang): Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  platform,
  session,
  mocked,
  children,
}: {
  platform: Platform;
  session: AuthResponse;
  mocked: boolean;
  children: ReactNode;
}) {
  const [user, setUser] = useState(session.user);
  const userRef = useRef(user);
  userRef.current = user;
  const token = session.token;

  const api = useMemo(
    () => createApiClient({ base: API_BASE, fetch: (i, init) => fetch(i, init), getToken: () => token }),
    [token],
  );

  const updateMe = useCallback(
    async (patch: MePatch) => {
      if (patch.lang) getI18n(patch.lang);
      const next = mocked
        ? mockUpdateMe(userRef.current, patch)
        : await api.request<SessionUser>('/me', { method: 'PATCH', json: patch });
      setUser(next);
      return next;
    },
    [api, mocked],
  );

  const setLang = useCallback(async (lang: Lang) => {
    await updateMe({ lang });
  }, [updateMe]);

  const value = useMemo<AppContextValue>(
    () => ({ platform, api, token, user, role: session.role, mocked, updateMe, setLang }),
    [platform, api, token, user, session.role, mocked, updateMe, setLang],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Сессия, платформа и API для экранов фич. */
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp вне AppProvider');
  return ctx;
}

/** Тактильный отклик: selection — даты и чипы, impact — избранное, notification — оплата. */
export function useHaptic(): Platform['haptic'] {
  return useApp().platform.haptic;
}
