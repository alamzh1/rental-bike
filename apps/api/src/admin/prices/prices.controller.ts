import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminExtra, AdminListOf, AdminModelTariffs, AdminSeason } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { PricesService } from './prices.service';

// Цены — владелец своей точки и ADMIN (сегменты tariffs, seasons, extras закрыты менеджеру и в AdminAccessMiddleware).
// Опции общие на все точки: владелец их только читает.

@ApiTags('admin')
@Controller('admin/tariffs')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class AdminTariffsController {
  constructor(private readonly prices: PricesService) {}

  @Get()
  list(@CurrentUser() user: AdminUser): Promise<AdminListOf<AdminModelTariffs>> {
    return this.prices.tariffs(user);
  }

  /** `{ tariffs: [{ minDays, maxDays, pricePerDay }], deposit? }` — сетка целиком. */
  @Patch(':modelId')
  set(@CurrentUser() user: AdminUser, @Param('modelId') modelId: string, @Body() body: unknown): Promise<AdminModelTariffs> {
    return this.prices.setTariffs(user, modelId, body);
  }
}

@ApiTags('admin')
@Controller('admin/seasons')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class AdminSeasonsController {
  constructor(private readonly prices: PricesService) {}

  @Get()
  list(@CurrentUser() user: AdminUser): Promise<AdminListOf<AdminSeason>> {
    return this.prices.seasons(user);
  }

  @Post()
  create(@CurrentUser() user: AdminUser, @Body() body: unknown): Promise<AdminSeason> {
    return this.prices.saveSeason(user, null, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminSeason> {
    return this.prices.saveSeason(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<void> {
    return this.prices.deleteSeason(user, id);
  }
}

@ApiTags('admin')
@Controller('admin/extras')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class AdminExtrasController {
  constructor(private readonly prices: PricesService) {}

  @Get()
  list(): Promise<AdminListOf<AdminExtra>> {
    return this.prices.extras();
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentUser() user: AdminUser, @Body() body: unknown): Promise<AdminExtra> {
    return this.prices.saveExtra(user, null, body);
  }

  /** Удаления нет: опция в старых бронях — выключается `isActive: false`. */
  @Patch(':id')
  @Roles('ADMIN')
  update(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminExtra> {
    return this.prices.saveExtra(user, id, body);
  }
}
