import { Injectable } from '@nestjs/common';
import { rateLimited } from './errors';

// Ограничение частоты (история 53): не больше 10 созданий брони и 10 созданий платежа в минуту на пользователя.
// Счётчик в памяти процесса (скользящее окно); при нескольких инстансах API — на инстанс.
export const RATE_LIMIT_PER_MINUTE = 10;
const WINDOW_MS = 60_000;

@Injectable()
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  /** Засчитать попытку; превышение → 429 RATE_LIMITED. */
  hit(bucket: 'booking' | 'payment' | 'document', userId: string, now = Date.now()): void {
    const key = `${bucket}:${userId}`;
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= RATE_LIMIT_PER_MINUTE) {
      this.hits.set(key, recent);
      throw rateLimited();
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(now);
  }

  reset(): void {
    this.hits.clear();
  }

  private prune(now: number): void {
    for (const [k, v] of this.hits) if (v.every((t) => now - t >= WINDOW_MS)) this.hits.delete(k);
  }
}
