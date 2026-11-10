// Форма настроек: какие ключи изменились (уходят в PATCH только они) и курс «₫ за 1 ₽/$» ↔ «₽/$ за 1 ₫» (как хранит API).

export function changedKeys<T extends object>(form: T, base: T): (keyof T)[] {
  return (Object.keys(form) as (keyof T)[]).filter((k) => JSON.stringify(form[k]) !== JSON.stringify(base[k]));
}

/** 0.003533 ₽ за 1 ₫ → 283 ₫ за 1 ₽ (до 2 знаков). */
export function toVndPer(rate: number): number | null {
  return rate > 0 ? Math.round((1 / rate) * 100) / 100 : null;
}

/** 283 ₫ за 1 ₽ → ₽ за 1 ₫. Пусто или 0 → 0 (сервер отклонит). */
export function fromVndPer(vndPer: number | null): number {
  return vndPer && vndPer > 0 ? 1 / vndPer : 0;
}
