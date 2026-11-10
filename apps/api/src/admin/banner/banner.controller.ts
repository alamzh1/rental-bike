import { Body, Controller, Get, Post, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AdminBannerResponse } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { readImageBody } from '../fleet/images';
import { BannerService } from './banner.service';

@ApiTags('admin')
@Controller('admin/banner')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('ADMIN')
export class AdminBannerController {
  constructor(private readonly banner: BannerService) {}

  @Get()
  get(): Promise<AdminBannerResponse> {
    return this.banner.get();
  }

  @Patch()
  save(@CurrentUser() user: AdminUser, @Body() body: unknown): Promise<AdminBannerResponse> {
    return this.banner.save(user, body);
  }

  @Post('image')
  async image(@CurrentUser() user: AdminUser, @Req() req: Request): Promise<AdminBannerResponse> {
    return this.banner.image(user, await readImageBody(req));
  }
}
