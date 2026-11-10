import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminActArchive, AdminActPhotos, AdminBookingDetail, AdminBookingList, DocumentUrlResponse } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { AdminBookingsService } from './admin-bookings.service';

@ApiTags('admin')
@Controller('admin/bookings')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('MANAGER', 'OWNER', 'ADMIN')
export class AdminBookingsController {
  constructor(private readonly service: AdminBookingsService) {}

  @Get()
  list(@CurrentUser() user: AdminUser, @Query() q: Record<string, unknown>): Promise<AdminBookingList> {
    return this.service.list(user, q);
  }

  @Post()
  create(@CurrentUser() user: AdminUser, @Body() body: unknown): Promise<AdminBookingDetail> {
    return this.service.createManual(user, body);
  }

  @Get(':id')
  detail(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<AdminBookingDetail> {
    return this.service.detail(user, id);
  }

  @Patch(':id')
  patch(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminBookingDetail> {
    return this.service.patch(user, id, body);
  }

  @Get(':id/documents/:documentId/url')
  documentUrl(@CurrentUser() user: AdminUser, @Param('id') id: string, @Param('documentId') documentId: string): Promise<DocumentUrlResponse> {
    return this.service.documentUrl(user, id, documentId);
  }

  /** Байк нашёлся на месте: случай закрыт. */
  @Post(':id/incident/dismiss')
  @HttpCode(200)
  dismissIncident(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<AdminBookingDetail> {
    return this.service.dismissIncident(user, id);
  }

  /** Байка нет: отмена с полным возвратом. */
  @Post(':id/incident/cancel')
  @HttpCode(200)
  cancelIncident(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<AdminBookingDetail> {
    return this.service.cancelIncident(user, id);
  }

  @Get(':id/acts/:actId/photos')
  actPhotos(@CurrentUser() user: AdminUser, @Param('id') id: string, @Param('actId') actId: string): Promise<AdminActPhotos> {
    return this.service.actPhotos(user, id, actId);
  }
}

/** Архив фотоактов: владелец — своей точки, администратор — всех или выбранной. */
@ApiTags('admin')
@Controller('admin/acts')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class AdminActsController {
  constructor(private readonly service: AdminBookingsService) {}

  @Get()
  list(@CurrentUser() user: AdminUser, @Query() q: Record<string, unknown>): Promise<AdminActArchive> {
    return this.service.actArchive(user, q);
  }
}
