// Общие типы HTTP API.

/** Ошибка API: `code` — машинный, текст переводит клиент через errors.<code>. */
export interface ApiError {
  code: string;
  message: string;
}

export interface HealthResponse {
  status: 'ok';
}
