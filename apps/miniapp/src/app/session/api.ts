import type { ApiError } from '@rental/shared';

/** Ошибка HTTP API: code — машинный, текст переводит клиент через errors.<code>. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiClient {
  request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T>;
}

/** JSON-клиент API: префикс, Bearer-токен, разбор ошибок { code, message }. Сеть недоступна → NETWORK. */
export function createApiClient(opts: { base: string; fetch: FetchLike; getToken: () => string | null }): ApiClient {
  return {
    async request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
      const { json, headers, ...rest } = init;
      const token = opts.getToken();
      let res: Response;
      try {
        res = await opts.fetch(`${opts.base}${path}`, {
          ...rest,
          headers: {
            ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
          body: json !== undefined ? JSON.stringify(json) : rest.body,
        });
      } catch {
        throw new ApiRequestError(0, 'NETWORK');
      }
      if (!res.ok) throw new ApiRequestError(res.status, await errorCode(res));
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    },
  };
}

async function errorCode(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as Partial<ApiError>;
    if (typeof body.code === 'string' && body.code) return body.code;
  } catch {
    // не JSON
  }
  if (res.status === 401) return 'UNAUTHORIZED';
  if (res.status === 403) return 'FORBIDDEN';
  if (res.status === 404) return 'NOT_FOUND';
  if (res.status === 429) return 'RATE_LIMITED';
  return 'UNKNOWN';
}
