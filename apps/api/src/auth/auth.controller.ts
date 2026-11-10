import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthResponse, DevUser, MeUser } from '@rental/shared';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './auth.types';
import { badRequest } from './api-errors';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/telegram')
  @HttpCode(200)
  login(@Body() body: unknown): Promise<AuthResponse> {
    const b = (body && typeof body === 'object' ? body : {}) as { initData?: unknown; devUser?: unknown };
    if (typeof b.initData === 'string' && b.initData.length > 0) return this.auth.loginTelegram(b.initData);
    if (typeof b.devUser === 'string') return this.auth.loginDev(b.devUser as DevUser);
    throw badRequest('initData is required');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): Promise<MeUser> {
    return this.auth.me(user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  update(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<MeUser> {
    return this.auth.updateMe(user.id, body);
  }
}
