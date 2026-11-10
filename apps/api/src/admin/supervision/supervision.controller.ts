import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminSupervision } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { SupervisionService } from './supervision.service';

/** Контроль владельцев: только администратор платформы (сегмента supervision нет в списке владельца). */
@ApiTags('admin')
@Controller('admin/supervision')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('ADMIN')
export class SupervisionController {
  constructor(private readonly supervision: SupervisionService) {}

  @Get()
  overview(@CurrentUser() user: AdminUser): Promise<AdminSupervision> {
    return this.supervision.overview(user);
  }
}
