import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthUser } from './auth.types';
import { AuthService } from './auth.service';
import { unauthorized } from './api-errors';

type Req = { headers: Record<string, string | string[] | undefined>; user?: AuthUser | null };

/**
 * Сессия Mini App: `Authorization: Bearer <JWT>` (выдаёт POST /auth/telegram) или `Authorization: tma <initData>`.
 * Роль берётся из БД и ADMIN_TELEGRAM_IDS на каждый запрос — смена роли действует сразу.
 */
async function resolve(auth: AuthService, req: Req): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const [scheme, ...rest] = value.split(' ');
  const credentials = rest.join(' ').trim();
  if (!credentials) throw unauthorized();
  if (scheme?.toLowerCase() === 'bearer') return auth.userFromToken(credentials);
  if (scheme?.toLowerCase() === 'tma') return auth.userFromInitData(credentials);
  throw unauthorized();
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Req>();
    const user = await resolve(this.auth, req);
    if (!user) throw unauthorized();
    req.user = user;
    return true;
  }
}

/** Как JwtAuthGuard, но пропускает анонимный запрос (request.user = null). Неверный токен — всё равно 401. */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Req>();
    req.user = await resolve(this.auth, req);
    return true;
  }
}
