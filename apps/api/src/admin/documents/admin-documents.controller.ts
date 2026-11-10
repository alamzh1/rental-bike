import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminDocumentList, DocumentDto, DocumentUrlResponse } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { AdminDocumentsService } from './admin-documents.service';

/** Документы клиентов проверяет только администратор. Менеджер и владелец их видят, но решения не принимают. */
@ApiTags('admin')
@Controller('admin/documents')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDocumentsController {
  constructor(private readonly documents: AdminDocumentsService) {}

  @Get()
  list(@Query() q: Record<string, unknown>): Promise<AdminDocumentList> {
    return this.documents.list(q);
  }

  @Get(':id/url')
  url(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<DocumentUrlResponse> {
    return this.documents.url(user, id);
  }

  /** `{ status: 'VERIFIED' | 'REJECTED', rejectReason? }`; отклонение сообщает клиенту в боте. */
  @Post(':id/verify')
  @HttpCode(200)
  verify(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<DocumentDto> {
    return this.documents.verify(user, id, body);
  }
}
