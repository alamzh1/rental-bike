import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { ChessResponse } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { ChessService } from './chess.service';

/** GET /admin/chess?from&to — перенос и ручная бронь идут через /admin/bookings. */
@ApiTags('admin')
@Controller('admin/chess')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('MANAGER', 'OWNER', 'ADMIN')
export class ChessController {
  constructor(private readonly service: ChessService) {}

  @Get()
  get(@CurrentUser() user: AdminUser, @Query() q: Record<string, unknown>): Promise<ChessResponse> {
    return this.service.get(user, q);
  }
}
