// Значения сборки (vite.config.ts → define). Секретов нет: только адрес API.
declare const __API_BASE__: string;

export const API_BASE: string = typeof __API_BASE__ === 'string' ? __API_BASE__ : '/api';
