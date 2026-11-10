import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { LANGS, type AdminAuthConfig, type AdminLoginLink, type AdminLoginLinkStatus, type AdminSessionResponse, type AdminWebAppSession, type Lang } from '@rental/shared';
import { badRequest } from '../../auth/api-errors';
import { AuthService } from '../../auth/auth.service';
import { describeDevice, type LoginLinkOrigin } from '../../notifications/admin-login-links';
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_SEC, AdminSessionService, adminDevAuthEnabled, adminLocalDevAuth, sessionToken, type AdminUser } from './admin-session.service';
import { AdminSessionGuard, assertAdminRequestHeader, type AdminRequest } from './admin-session.guard';

/** Secure, если вход идёт по HTTPS: `pnpm public` работает как development, но открыт в интернет. На localhost флага нет, иначе Safari не примет cookie. */
const cookieOptions = (req: AdminRequest) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https',
  path: '/api',
});

/** Адрес и устройство для подтверждения в боте. req.ip определяет trust proxy: заголовком клиента его не подменить. Страна — подсказка от Cloudflare. */
function loginOrigin(req: AdminRequest & { ip?: string }): LoginLinkOrigin {
  const country = req.headers['cf-ipcountry'];
  return { ip: req.ip || '?', country: typeof country === 'string' ? country : null, device: describeDevice(req.headers['user-agent'] as string | undefined) };
}

@ApiTags('admin')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly sessions: AdminSessionService,
    private readonly auth: AuthService,
  ) {}

  @Get('config')
  config(@Req() req: AdminRequest): AdminAuthConfig {
    return { botUsername: process.env.TELEGRAM_BOT_USERNAME || null, devAuth: adminDevAuthEnabled() || adminLocalDevAuth(req) };
  }

  @Post('telegram')
  @HttpCode(200)
  async telegram(@Req() req: AdminRequest, @Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<AdminSessionResponse> {
    assertAdminRequestHeader(req);
    const { token, session } = await this.sessions.loginWidget(body);
    res.cookie(ADMIN_COOKIE, token, { ...cookieOptions(req), maxAge: ADMIN_SESSION_TTL_SEC * 1000 });
    return session;
  }

  /** Вход через бота: номер телефона не нужен, браузер ждёт подтверждения в чате. */
  @Post('link')
  @HttpCode(200)
  link(@Req() req: AdminRequest, @Body() body: unknown): AdminLoginLink {
    assertAdminRequestHeader(req);
    const lang = (body as { lang?: unknown } | null)?.lang;
    return this.sessions.createLoginLink({ ...loginOrigin(req), ...(LANGS.includes(lang as Lang) ? { lang: lang as Lang } : {}) });
  }

  @Post('link/status')
  @HttpCode(200)
  async linkStatus(@Req() req: AdminRequest, @Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<AdminLoginLinkStatus> {
    assertAdminRequestHeader(req);
    const secret = (body as { secret?: unknown } | null)?.secret;
    if (typeof secret !== 'string' || !secret || secret.length > 100) throw badRequest('secret is required');
    const r = await this.sessions.pollLoginLink(secret);
    if (r.status !== 'confirmed') return r;
    res.cookie(ADMIN_COOKIE, r.token, { ...cookieOptions(req), maxAge: ADMIN_SESSION_TTL_SEC * 1000 });
    return { status: 'confirmed', ...r.session };
  }

  /** Внутри Telegram: сотрудник входит без формы, по подписи Telegram. */
  @Post('webapp')
  @HttpCode(200)
  async webapp(@Req() req: AdminRequest, @Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<AdminWebAppSession> {
    assertAdminRequestHeader(req);
    const initData = (body as { initData?: unknown } | null)?.initData;
    if (typeof initData !== 'string' || !initData) throw badRequest('initData is required');
    const { token, session } = await this.sessions.loginWebApp(initData);
    res.cookie(ADMIN_COOKIE, token, { ...cookieOptions(req), maxAge: ADMIN_SESSION_TTL_SEC * 1000 });
    return { ...session, token };
  }

  @Post('dev')
  @HttpCode(200)
  async dev(@Req() req: AdminRequest, @Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<AdminSessionResponse> {
    assertAdminRequestHeader(req);
    const { token, session } = await this.sessions.loginDev(body, adminDevAuthEnabled() || adminLocalDevAuth(req));
    res.cookie(ADMIN_COOKIE, token, { ...cookieOptions(req), maxAge: ADMIN_SESSION_TTL_SEC * 1000 });
    return session;
  }

  @Get('me')
  @UseGuards(AdminSessionGuard)
  async me(@Req() req: AdminRequest): Promise<AdminSessionResponse> {
    const user = req.user as AdminUser;
    return { me: await this.sessions.me(user), expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_SEC * 1000).toISOString() };
  }

  /** Язык, выбранный в админке: на нём бот пишет сотруднику. */
  @Post('lang')
  @HttpCode(204)
  @UseGuards(AdminSessionGuard)
  async setLang(@Req() req: AdminRequest, @Body() body: unknown): Promise<void> {
    assertAdminRequestHeader(req);
    await this.auth.updateMe((req.user as AdminUser).id, { lang: (body as { lang?: unknown } | null)?.lang ?? null });
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AdminRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    assertAdminRequestHeader(req);
    await this.sessions.revoke(sessionToken(req.headers));
    res.clearCookie(ADMIN_COOKIE, cookieOptions(req));
  }
}
