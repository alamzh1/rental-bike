import { Controller, Delete, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { FavoritesResponse, FavoriteStatus } from '@rental/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { notFound } from '../auth/api-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { parsePeriod } from '../catalog/query';

// Избранное: всегда по пользователю из сессии — чужое недоступно по построению.
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query() q: Record<string, unknown>): Promise<FavoritesResponse> {
    const rows = await this.prisma.favorite.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { modelId: true } });
    return { items: await this.catalog.cardsByIds(rows.map((r) => r.modelId), parsePeriod(q), user.id) };
  }

  @Get(':modelId')
  async status(@CurrentUser() user: AuthUser, @Param('modelId') modelId: string): Promise<FavoriteStatus> {
    const row = await this.prisma.favorite.findUnique({ where: { userId_modelId: { userId: user.id, modelId } } });
    return { modelId, favorite: !!row };
  }

  @Post(':modelId')
  async add(@CurrentUser() user: AuthUser, @Param('modelId') modelId: string): Promise<FavoriteStatus> {
    if (!(await this.catalog.exists(modelId))) throw notFound('Model not found');
    await this.prisma.favorite.upsert({ where: { userId_modelId: { userId: user.id, modelId } }, create: { userId: user.id, modelId }, update: {} });
    return { modelId, favorite: true };
  }

  @Delete(':modelId')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('modelId') modelId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId: user.id, modelId } });
  }
}
