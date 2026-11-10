import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import type { AvailabilityResponse, HomeResponse, ModelCountResponse, ModelDetail, ModelListResponse, NowResponse } from '@rental/shared';
import { OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { badRequest } from '../auth/api-errors';
import { AvailabilityService } from '../availability/availability.service';
import { CatalogService } from './catalog.service';
import { parseCatalogFilter, parsePeriod } from './query';

// Каталог открыт без сессии (сердечко isFavorite — только с сессией); неверный токен — 401.
@Controller()
@UseGuards(OptionalJwtAuthGuard)
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly availability: AvailabilityService,
  ) {}

  @Get('models')
  list(@Query() q: Record<string, unknown>, @CurrentUser() user: AuthUser | null): Promise<ModelListResponse> {
    return this.catalog.listModels(parseCatalogFilter(q), user?.id ?? null);
  }

  /** Число моделей под фильтры — для «Показать N байков» до применения. */
  @Get('models/count')
  async count(@Query() q: Record<string, unknown>): Promise<ModelCountResponse> {
    return { count: (await this.catalog.listModels(parseCatalogFilter(q))).count };
  }

  @Get('models/:id')
  get(@Param('id') id: string, @Query() q: Record<string, unknown>, @CurrentUser() user: AuthUser | null): Promise<ModelDetail> {
    return this.catalog.getModel(id, parsePeriod(q), user?.id ?? null);
  }

  @Get('models/:id/availability')
  async busy(@Param('id') id: string, @Query('month') month: unknown): Promise<AvailabilityResponse> {
    if (typeof month !== 'string') throw badRequest('month must be YYYY-MM');
    return { busy: await this.availability.busyDates(id, month) };
  }

  @Get('home')
  home(@Query() q: Record<string, unknown>, @CurrentUser() user: AuthUser | null): Promise<HomeResponse> {
    return this.catalog.home(parsePeriod(q), user?.id ?? null);
  }

  @Get('now')
  now(@CurrentUser() user: AuthUser | null): Promise<NowResponse> {
    return this.catalog.now(user?.id ?? null);
  }
}
