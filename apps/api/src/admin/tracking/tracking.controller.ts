import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminTrackedBikeDetail, AdminTrackerSetup, AdminTrackingList } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { TrackingService } from './tracking.service';

// Менеджер видит байки своей точки; деньги и подключение трекера — только администратор.
@ApiTags('admin')
@Controller('admin/tracking')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('MANAGER', 'OWNER', 'ADMIN')
export class AdminTrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get()
  list(@CurrentUser() user: AdminUser, @Query() q: Record<string, unknown>): Promise<AdminTrackingList> {
    return this.tracking.list(user, q);
  }

  @Get(':id')
  detail(@CurrentUser() user: AdminUser, @Param('id') id: string, @Query() q: Record<string, unknown>): Promise<AdminTrackedBikeDetail> {
    return this.tracking.detail(user, id, q);
  }

  @Put(':id/tracker')
  @Roles('OWNER', 'ADMIN')
  connect(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminTrackerSetup> {
    return this.tracking.connect(user, id, body);
  }

  @Delete(':id/tracker')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(204)
  disconnect(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<void> {
    return this.tracking.disconnect(user, id);
  }
}
