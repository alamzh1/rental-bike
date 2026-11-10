import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ANALYTICS_EVENTS, type AnalyticsEventName } from '@rental/shared';
import { OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { badRequest } from '../auth/api-errors';
import { AnalyticsService } from './analytics.service';

const MAX_PROPS = 20;
const MAX_STR = 200;

@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** POST /events { name, props?, source? } → 204. Без сессии пишется анонимно. */
  @Post('events')
  @HttpCode(204)
  @UseGuards(OptionalJwtAuthGuard)
  async track(@Body() body: unknown, @CurrentUser() user: AuthUser | null): Promise<void> {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (!ANALYTICS_EVENTS.includes(b.name as AnalyticsEventName)) throw badRequest('Unknown event name');
    let props: Record<string, unknown> | null = null;
    if (b.props !== undefined && b.props !== null) {
      if (typeof b.props !== 'object' || Array.isArray(b.props)) throw badRequest('props must be an object');
      const entries = Object.entries(b.props as Record<string, unknown>);
      const flat = entries.every(([k, v]) => k.length <= 50 && (v === null || ['number', 'boolean'].includes(typeof v) || (typeof v === 'string' && v.length <= MAX_STR)));
      if (entries.length > MAX_PROPS || !flat) throw badRequest('props must be flat: string | number | boolean | null');
      props = Object.fromEntries(entries);
    }
    if (b.source !== undefined && b.source !== null && (typeof b.source !== 'string' || b.source.length > 100)) throw badRequest('source must be a string');
    await this.analytics.track(user?.id ?? null, b.name as string, props, (b.source as string | undefined) ?? null);
  }
}
