import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminTextList, AdminTextRow } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { TextsService } from './texts.service';

@ApiTags('admin')
@Controller('admin/texts')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminTextsController {
  constructor(private readonly texts: TextsService) {}

  @Get()
  list(): Promise<AdminTextList> {
    return this.texts.list();
  }

  /** `{ lang, key, value }` — пустое value удаляет правку. */
  @Patch()
  save(@CurrentUser() user: AdminUser, @Body() body: unknown): Promise<AdminTextRow> {
    return this.texts.save(user, body);
  }
}
