import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminListOf, AdminLocation } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { LocationsService } from './locations.service';

@ApiTags('admin')
@Controller('admin/locations')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class AdminLocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  list(@CurrentUser() user: AdminUser): Promise<AdminListOf<AdminLocation>> {
    return this.locations.list(user);
  }

  @Post()
  @Roles('ADMIN')
  create(@CurrentUser() user: AdminUser, @Body() body: unknown): Promise<AdminLocation> {
    return this.locations.save(user, null, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminLocation> {
    return this.locations.save(user, id, body);
  }

  /** `{ telegramId }` — владелец точки: видит только её. Назначает администратор. */
  @Post(':id/owners')
  @Roles('ADMIN')
  addOwner(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminLocation> {
    return this.locations.addOwner(user, id, body);
  }

  @Delete(':id/owners/:userId')
  @Roles('ADMIN')
  removeOwner(@CurrentUser() user: AdminUser, @Param('id') id: string, @Param('userId') userId: string): Promise<AdminLocation> {
    return this.locations.removeOwner(user, id, userId);
  }

  /** `{ clientId, apiKey, checksumKey }` — свой счёт payOS: ключи проверяются у payOS и больше не показываются. */
  @Put(':id/payos')
  setPayos(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminLocation> {
    return this.locations.setPayos(user, id, body);
  }

  @Delete(':id/payos')
  clearPayos(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<AdminLocation> {
    return this.locations.clearPayos(user, id);
  }

  /** `{ telegramId }` */
  @Post(':id/managers')
  addManager(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminLocation> {
    return this.locations.addManager(user, id, body);
  }

  @Delete(':id/managers/:userId')
  removeManager(@CurrentUser() user: AdminUser, @Param('id') id: string, @Param('userId') userId: string): Promise<AdminLocation> {
    return this.locations.removeManager(user, id, userId);
  }
}
