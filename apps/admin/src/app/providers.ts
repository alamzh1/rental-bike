import type { AccessControlProvider, AuthProvider, DataProvider } from '@refinedev/core';
import { canOpenSection, type AdminMe, type AdminSection, type AdminSessionResponse, type AdminWebAppSession, ADMIN_SECTIONS } from '@rental/shared';
import { AdminApiError, createAdminApi, setSessionToken } from './api';
import { telegramInitData } from './telegram';
import { API_BASE } from './env';

// Провайдеры Refine (headless): данные — REST /api/admin/*, вход — cookie-сессия, доступ — роли из packages/shared.

// Сессия истекла при любом запросе: на вход, а не бесконечное «Повторить» в разделах с собственными запросами
export const api = createAdminApi({
  base: API_BASE,
  fetch: async (input, init) => {
    const res = await fetch(input, init);
    if (res.status === 401 && !input.includes('/admin/auth/') && location.pathname !== '/login') {
      me = null;
      setSessionToken(null);
      location.assign('/login?expired=1');
    }
    return res;
  },
});

let me: AdminMe | null = null;
let pending: Promise<AdminMe | null> | null = null;

/** Текущий сотрудник (кэш на время вкладки; сбрасывается при выходе и 401). */
export function loadMe(force = false): Promise<AdminMe | null> {
  if (me && !force) return Promise.resolve(me);
  // Внутри Telegram вход по его подписи: аккаунт всегда тот, кто открыл админку, а не сохранённая cookie
  const initData = telegramInitData();
  const session = initData
    ? () => api.post<AdminWebAppSession>('/admin/auth/webapp', { initData }).then((r) => (setSessionToken(r.token), r))
    : () => api.get<AdminSessionResponse>('/admin/auth/me');
  pending ??= session()
    .then((r) => (me = r.me))
    .catch((e: unknown) => {
      if (e instanceof AdminApiError && (e.statusCode === 401 || e.statusCode === 403)) return (me = null);
      throw e;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export type LoginParams = { mode: 'widget'; data: Record<string, unknown> } | { mode: 'dev'; role: 'admin' | 'manager' | 'owner' } | { mode: 'session' };

export const authProvider: AuthProvider = {
  async login(params: LoginParams) {
    try {
      // Вход через бота: cookie уже поставлен, остаётся прочитать сотрудника
      if (params.mode === 'session') return (await loadMe(true)) ? { success: true, redirectTo: '/' } : { success: false, error: { name: 'FORBIDDEN', message: 'FORBIDDEN' } };
      const r = params.mode === 'widget' ? await api.post<AdminSessionResponse>('/admin/auth/telegram', params.data) : await api.post<AdminSessionResponse>('/admin/auth/dev', { role: params.role });
      me = r.me;
      return { success: true, redirectTo: '/' };
    } catch (e) {
      const code = e instanceof AdminApiError ? e.code : 'UNKNOWN';
      return { success: false, error: { name: code, message: code } };
    }
  },
  async logout() {
    await api.post('/admin/auth/logout').catch(() => undefined);
    me = null;
    return { success: true, redirectTo: '/login' };
  },
  async check() {
    try {
      return (await loadMe()) ? { authenticated: true } : { authenticated: false, redirectTo: '/login', logout: true };
    } catch {
      return { authenticated: false, redirectTo: '/login' };
    }
  },
  async onError(error: unknown) {
    if (error instanceof AdminApiError && error.statusCode === 401) {
      me = null;
      return { logout: true, redirectTo: '/login?expired=1' };
    }
    return {};
  },
  getIdentity: () => loadMe(),
  getPermissions: async () => (await loadMe())?.role ?? null,
};

export const accessControlProvider: AccessControlProvider = {
  async can({ resource }) {
    const role = (await loadMe())?.role;
    if (!role || !resource) return { can: false };
    if (!(ADMIN_SECTIONS as readonly string[]).includes(resource)) return { can: role === 'ADMIN' };
    return { can: canOpenSection(role, resource as AdminSection) };
  },
};

/** REST админки: ресурс = сегмент /api/admin/<resource>. Параметры списка — meta.query (как в GET /admin/bookings). */
export const dataProvider: DataProvider = {
  getApiUrl: () => `${API_BASE}/admin`,
  async getList({ resource, meta }) {
    const r = await api.get<{ items: unknown[]; total: number }>(`/admin/${resource}`, (meta?.query ?? {}) as Record<string, string>);
    return { data: r.items as never[], total: r.total };
  },
  async getOne({ resource, id }) {
    return { data: await api.get(`/admin/${resource}/${encodeURIComponent(String(id))}`) };
  },
  async create({ resource, variables }) {
    return { data: await api.post(`/admin/${resource}`, variables) };
  },
  async update({ resource, id, variables }) {
    return { data: await api.patch(`/admin/${resource}/${encodeURIComponent(String(id))}`, variables) };
  },
  async deleteOne({ resource, id }) {
    return { data: await api.del(`/admin/${resource}/${encodeURIComponent(String(id))}`) };
  },
  async custom({ url, method, payload, query }) {
    const path = url.startsWith('/') ? url : `/${url}`;
    const q = (query ?? {}) as Record<string, string>;
    const data = method === 'get' ? await api.get(path, q) : method === 'patch' ? await api.patch(path, payload) : method === 'delete' ? await api.del(path) : await api.post(path, payload);
    return { data: data as never };
  },
};
