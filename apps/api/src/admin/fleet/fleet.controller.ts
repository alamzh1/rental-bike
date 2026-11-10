import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AdminBike, AdminBrand, AdminListOf, AdminModel, BikeDocUpload, DocumentUrlResponse } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { FleetService } from './fleet.service';
import { readImageBody } from './images';

// Сегменты models, bikes, brands открыты менеджеру (ADMIN_API_MANAGER_SEGMENTS) — чтение своей точки без цен;
// изменения моделей и брендов, тарифы и депозит — только ADMIN (403 менеджеру).

@ApiTags('admin')
@Controller('admin/brands')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('MANAGER', 'OWNER', 'ADMIN')
export class AdminBrandsController {
  constructor(private readonly fleet: FleetService) {}

  @Get()
  list(): Promise<AdminListOf<AdminBrand>> {
    return this.fleet.brands();
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentUser() user: AdminUser, @Body() body: unknown): Promise<AdminBrand> {
    return this.fleet.saveBrand(user, null, body);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminBrand> {
    return this.fleet.saveBrand(user, id, body);
  }

  /** Тело — файл изображения (Content-Type: image/*). */
  @Post(':id/logo')
  @Roles('ADMIN')
  async logo(@CurrentUser() user: AdminUser, @Param('id') id: string, @Req() req: Request): Promise<AdminBrand> {
    return this.fleet.brandLogo(user, id, await readImageBody(req));
  }
}

@ApiTags('admin')
@Controller('admin/models')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('MANAGER', 'OWNER', 'ADMIN')
export class AdminModelsController {
  constructor(private readonly fleet: FleetService) {}

  @Get()
  list(@CurrentUser() user: AdminUser, @Query() q: Record<string, unknown>): Promise<AdminListOf<AdminModel>> {
    return this.fleet.models(user, q);
  }

  @Get(':id')
  one(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<AdminModel> {
    return this.fleet.model(user, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@CurrentUser() user: AdminUser, @Body() body: unknown): Promise<AdminModel> {
    return this.fleet.createModel(user, body);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminModel> {
    return this.fleet.updateModel(user, id, body);
  }

  /** Тело — файл изображения (Content-Type: image/*) → WebP/AVIF 400/800/1200. */
  @Post(':id/photos')
  @Roles('OWNER', 'ADMIN')
  async addPhoto(@CurrentUser() user: AdminUser, @Param('id') id: string, @Req() req: Request): Promise<AdminModel> {
    return this.fleet.addPhoto(user, id, await readImageBody(req));
  }

  /** `{ key, action: 'delete' | 'main' }` */
  @Patch(':id/photos')
  @Roles('OWNER', 'ADMIN')
  photos(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminModel> {
    return this.fleet.updatePhotos(user, id, body);
  }
}

@ApiTags('admin')
@Controller('admin/bikes')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('MANAGER', 'OWNER', 'ADMIN')
export class AdminBikesController {
  constructor(private readonly fleet: FleetService) {}

  @Get()
  list(@CurrentUser() user: AdminUser, @Query() q: Record<string, unknown>): Promise<AdminListOf<AdminBike>> {
    return this.fleet.bikes(user, q);
  }

  @Get(':id')
  one(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<AdminBike> {
    return this.fleet.bike(user, id);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@CurrentUser() user: AdminUser, @Body() body: unknown): Promise<AdminBike> {
    return this.fleet.createBike(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminBike> {
    return this.fleet.updateBike(user, id, body);
  }

  /** `{ contentType }` → подписанная ссылка PUT в приватное хранилище. */
  @Post(':id/documents/:kind')
  @Roles('OWNER', 'ADMIN')
  docUpload(@CurrentUser() user: AdminUser, @Param('id') id: string, @Param('kind') kind: string, @Body() body: unknown): Promise<BikeDocUpload> {
    return this.fleet.docUpload(user, id, kind, body);
  }

  /** Файл загружен: документ закрепляется за байком. */
  @Post(':id/documents/:kind/confirm')
  @Roles('OWNER', 'ADMIN')
  docConfirm(@CurrentUser() user: AdminUser, @Param('id') id: string, @Param('kind') kind: string, @Body() body: unknown): Promise<AdminBike> {
    return this.fleet.docConfirm(user, id, kind, body);
  }

  @Get(':id/documents/:kind/url')
  docUrl(@CurrentUser() user: AdminUser, @Param('id') id: string, @Param('kind') kind: string): Promise<DocumentUrlResponse> {
    return this.fleet.docUrl(user, id, kind);
  }
}
