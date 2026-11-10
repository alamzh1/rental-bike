// Значения сборки (vite.config.ts → define). Секретов здесь нет: только флаги и публичные адреса.
declare const __DEV_AUTH__: boolean;
declare const __API_BASE__: string;
declare const __BOT_USERNAME__: string;

export const DEV_AUTH: boolean = __DEV_AUTH__;
export const API_BASE: string = __API_BASE__;
export const BOT_USERNAME: string = __BOT_USERNAME__;
