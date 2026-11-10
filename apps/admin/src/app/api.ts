import { ADMIN_LOCATION_HEADER, ADMIN_REQUEST_HEADER, type AdminConflictError, type ApiError } from '@rental/shared';

// HTTP-клиент админки: cookie-сессия (credentials: include), заголовок x-admin-request на изменениях (CSRF),
// ошибки { code, message, conflict? } → AdminApiError (совместима с HttpError Refine: message + statusCode).

export class AdminApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    readonly conflict?: AdminConflictError['conflict'],
  ) {
    super(code);
  }
}

let bearer: string | null = null;

/** Токен сессии внутри Telegram: в браузерной версии Telegram админка во фрейме, и cookie не отправляется. */
export function setSessionToken(token: string | null): void {
  bearer = token;
}

const POINT_KEY = 'admin_point';

/** Точка, которую выбрал администратор; null — все точки. Переключатель в меню, сервер проверяет права сам. */
export function selectedPoint(): string | null {
  try {
    return localStorage.getItem(POINT_KEY);
  } catch {
    return null;
  }
}

export function selectPoint(id: string | null): void {
  try {
    if (id) localStorage.setItem(POINT_KEY, id);
    else localStorage.removeItem(POINT_KEY);
  } catch {
    // без хранилища выбор живёт до перезагрузки — переключатель просто вернётся ко всем точкам
  }
}

export const sessionHeaders = (): Record<string, string> => {
  const point = selectedPoint();
  return { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(point ? { [ADMIN_LOCATION_HEADER]: point } : {}) };
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type Query = Record<string, string | number | undefined | null>;

export interface AdminApi {
  get<T>(path: string, query?: Query): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
}

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}

export function createAdminApi(opts: { base: string; fetch: FetchLike }): AdminApi {
  async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json', ...sessionHeaders() };
    if (method !== 'GET') headers[ADMIN_REQUEST_HEADER] = '1';
    if (body !== undefined) headers['content-type'] = 'application/json';
    let res: Response;
    try {
      res = await opts.fetch(`${opts.base}${path}`, { method, credentials: 'include', headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      throw new AdminApiError(0, 'NETWORK');
    }
    if (res.status === 204) return undefined as T;
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (!res.ok) {
      const e = (json ?? {}) as Partial<ApiError> & { conflict?: AdminConflictError['conflict'] };
      const fallback = res.status === 401 ? 'UNAUTHORIZED' : res.status === 403 ? 'FORBIDDEN' : res.status === 404 ? 'NOT_FOUND' : 'UNKNOWN';
      throw new AdminApiError(res.status, typeof e.code === 'string' && e.code ? e.code : fallback, e.conflict);
    }
    return json as T;
  }
  return {
    get: (path, query) => send('GET', withQuery(path, query)),
    post: (path, body) => send('POST', path, body ?? {}),
    patch: (path, body) => send('PATCH', path, body ?? {}),
    put: (path, body) => send('PUT', path, body ?? {}),
    del: (path) => send('DELETE', path),
  };
}
