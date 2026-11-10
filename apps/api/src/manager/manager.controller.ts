import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type {
  ActPhotoUploadResponse,
  CashResponse,
  HandoverResponse,
  ManagerBike,
  ManagerBookingDetail,
  ManagerTodayResponse,
  NoShowResponse,
  ReturnResponse,
} from '@rental/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { Roles, RolesGuard } from '../auth/roles';
import { ManagerService } from './manager.service';

/** Режим менеджера. Только MANAGER/ADMIN: запрос клиента → 403 FORBIDDEN. */
@Controller('manager')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGER', 'OWNER', 'ADMIN')
export class ManagerController {
  constructor(private readonly manager: ManagerService) {}

  private actor(u: AuthUser) {
    return { id: u.id, role: u.role };
  }

  @Get('today')
  today(@CurrentUser() u: AuthUser): Promise<ManagerTodayResponse> {
    return this.manager.today(this.actor(u));
  }

  @Get('bikes')
  bikes(@CurrentUser() u: AuthUser): Promise<ManagerBike[]> {
    return this.manager.bikes(this.actor(u));
  }

  /** {code} — BK-24117, текст QR или ID брони. */
  @Get('bookings/:code')
  detail(@CurrentUser() u: AuthUser, @Param('code') code: string): Promise<ManagerBookingDetail> {
    return this.manager.detail(this.actor(u), decodeURIComponent(code));
  }

  @Post('bookings/:id/photos')
  @HttpCode(200)
  photos(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<ActPhotoUploadResponse> {
    return this.manager.photoUpload(this.actor(u), id, body);
  }

  @Post('bookings/:id/handover')
  handover(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<HandoverResponse> {
    return this.manager.handover(this.actor(u), id, body);
  }

  @Post('bookings/:id/return')
  @HttpCode(200)
  returnBike(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<ReturnResponse> {
    return this.manager.returnBike(this.actor(u), id, body);
  }

  @Post('bookings/:id/cash')
  cash(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<CashResponse> {
    return this.manager.cash(this.actor(u), id, body);
  }

  @Post('bookings/:id/no-show')
  @HttpCode(200)
  noShow(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<NoShowResponse> {
    return this.manager.noShow(this.actor(u), id);
  }

  /** Байка нет на месте: открыть случай. */
  @Post('bookings/:id/incident')
  @HttpCode(200)
  async reportMissing(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<void> {
    await this.manager.reportMissing(this.actor(u), id, body);
  }

  @Post('bookings/:id/incident/propose')
  @HttpCode(200)
  async propose(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<void> {
    await this.manager.proposeReplacement(this.actor(u), id, body);
  }

  @Post('bookings/:id/incident/dismiss')
  @HttpCode(200)
  async dismiss(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    await this.manager.dismissMissing(this.actor(u), id);
  }

  @Post('bookings/:id/incident/cancel')
  @HttpCode(200)
  async cancelMissing(@CurrentUser() u: AuthUser, @Param('id') id: string): Promise<void> {
    await this.manager.cancelMissing(this.actor(u), id);
  }

  @Patch('bikes/:id')
  patchBike(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<ManagerBike> {
    return this.manager.patchBike(this.actor(u), id, body);
  }

}
