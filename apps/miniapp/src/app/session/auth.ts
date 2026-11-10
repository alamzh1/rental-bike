import type { AuthTelegramRequest, DevUser, Role } from '@rental/shared';
import type { LaunchMode } from '../platform/launch';
import { ApiRequestError, createApiClient, type FetchLike } from './api';
import { mockAuth } from './mock';
import type { AuthResponse } from './types';

export type SessionStart =
  | { status: 'outside' }
  | { status: 'ready'; session: AuthResponse; mocked: boolean }
  | { status: 'error'; code: string };

export interface StartSessionOptions {
  mode: LaunchMode;
  initData: string | undefined;
  fetch: FetchLike;
  apiBase: string;
  /** Только DEV_AUTH=1: пока эндпоинта нет или API не запущен — мок того же контракта. */
  allowMock: boolean;
  mockRole?: Role;
}

const DEV_USER_BY_ROLE: Record<Role, DevUser> = { CLIENT: 'client', MANAGER: 'manager', OWNER: 'owner', ADMIN: 'admin' };

/** Вход: POST /auth/telegram → { token, user, role }. В Telegram — initData; dev-режим браузера (initData без подписи) — { devUser }. Вне Telegram без DEV_AUTH — без запросов. */
export async function startSession(opts: StartSessionOptions): Promise<SessionStart> {
  if (opts.mode === 'outside' || !opts.initData) return { status: 'outside' };
  const api = createApiClient({ base: opts.apiBase, fetch: opts.fetch, getToken: () => null });
  try {
    const body: AuthTelegramRequest =
      opts.mode === 'dev' ? { devUser: DEV_USER_BY_ROLE[opts.mockRole ?? 'CLIENT'] } : { initData: opts.initData };
    const session = await api.request<AuthResponse>('/auth/telegram', { method: 'POST', json: body });
    return { status: 'ready', session, mocked: false };
  } catch (e) {
    const err = e instanceof ApiRequestError ? e : new ApiRequestError(0, 'UNKNOWN');
    // Эндпоинта нет (404/501) или API не запущен (сеть; прокси dev отвечает 5xx без JSON-ошибки).
    const endpointMissing =
      err.status === 404 || err.status === 501 || err.code === 'NETWORK' || (err.status >= 500 && err.code === 'UNKNOWN');
    if (opts.allowMock && endpointMissing) {
      return { status: 'ready', session: mockAuth(opts.initData, opts.mockRole), mocked: true };
    }
    return { status: 'error', code: err.code };
  }
}
