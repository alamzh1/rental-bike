import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminDashboard } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { DashboardService } from './dashboard.service';

@ApiTags('admin')
@Controller('admin/dashboard')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('MANAGER', 'OWNER', 'ADMIN')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  /** Выручка — только ADMIN (у менеджера revenue: null). */
  @Get()
  get(@CurrentUser() user: AdminUser, @Query('locationId') locationId?: string): Promise<AdminDashboard> {
    return this.service.get(user, locationId);
  }
}
