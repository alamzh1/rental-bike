import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminSettingsResponse, PublicSettings } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { SettingsService } from './settings.service';

@ApiTags('admin')
@Controller('admin/settings')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Promise<AdminSettingsResponse> {
    return this.settings.get();
  }

  @Patch()
  patch(@CurrentUser() user: AdminUser, @Body() body: unknown): Promise<AdminSettingsResponse> {
    return this.settings.patch(user, body);
  }
}

/** GET /api/settings/public — без авторизации (Mini App: FAQ, правила, политика, контакт, доставка, курсы). */
@ApiTags('settings')
@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('public')
  get(): Promise<PublicSettings> {
    return this.settings.publicSettings();
  }
}
