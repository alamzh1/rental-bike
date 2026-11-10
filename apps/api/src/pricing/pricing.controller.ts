import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { Quote, QuoteExtraRequest } from '@rental/shared';
import { badRequest } from '../auth/api-errors';
import { parseInstant } from '../catalog/query';
import { PricingService } from './pricing.service';

@Controller()
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /** POST /quotes { modelId, startAt, endAt, extras?, delivery? } → Quote. Публичный: расчёт не зависит от пользователя. */
  @Post('quotes')
  @HttpCode(200)
  create(@Body() body: unknown): Promise<Quote> {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (typeof b.modelId !== 'string' || !b.modelId) throw badRequest('modelId is required');
    const startAt = parseInstant(b.startAt, 'startAt');
    const endAt = parseInstant(b.endAt, 'endAt');
    const extrasRaw = b.extras ?? [];
    if (!Array.isArray(extrasRaw) || extrasRaw.length > 20) throw badRequest('extras must be an array');
    const extras: QuoteExtraRequest[] = extrasRaw.map((e: unknown) => {
      const x = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
      if (typeof x.id !== 'string' || typeof x.qty !== 'number') throw badRequest('extras: { id, qty }[]');
      return { id: x.id, qty: x.qty };
    });
    if (b.delivery !== undefined && typeof b.delivery !== 'boolean') throw badRequest('delivery must be boolean');
    return this.pricing.quoteFor(b.modelId, startAt, endAt, extras, { delivery: b.delivery === true });
  }
}
