import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { CreateDocumentRequest, CreateDocumentResponse, DocumentDto, DocumentListResponse, DocumentUrlResponse } from '@rental/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { Roles, RolesGuard } from '../auth/roles';
import { RateLimiter } from '../bookings/rate-limit';
import { DocumentsService, toDocumentDto } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly limiter: RateLimiter,
  ) {}

  /** POST /documents → { documentId, uploadUrl, method, headers, expiresAt } · 400 CONSENT_REQUIRED */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<CreateDocumentResponse> {
    this.limiter.hit('document', user.id);
    return this.docs.create(user.id, (body && typeof body === 'object' ? body : {}) as Partial<CreateDocumentRequest>);
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<DocumentListResponse> {
    return this.docs.list(user.id);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<DocumentDto> {
    return toDocumentDto(await this.docs.getOwn(user.id, id));
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    return this.docs.removeOwn(user.id, id);
  }

  /** GET /documents/{id}/url?ttl — только менеджер и администратор; ссылка ≤ 600 с. */
  @Get(':id/url')
  @Roles('MANAGER', 'OWNER', 'ADMIN')
  url(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('ttl') ttl?: string): Promise<DocumentUrlResponse> {
    const t = ttl === undefined ? undefined : Number(ttl);
    return this.docs.signedUrl({ id: user.id, role: user.role }, id, t !== undefined && Number.isFinite(t) && t > 0 ? t : undefined);
  }
}
