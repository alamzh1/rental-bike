import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ADMIN_REQUEST_HEADER } from '@rental/shared';
import { forbidden } from '../../auth/api-errors';
import { actingLocation, AdminSessionService, sessionToken, type AdminUser } from './admin-session.service';

export type AdminRequest = {
  method: string;
  path?: string;
  originalUrl?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: AdminUser | null;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Изменяющий запрос без заголовка x-admin-request → 403: cookie-сессию нельзя использовать с чужого сайта (CSRF). */
export function assertAdminRequestHeader(req: AdminRequest): void {
  if (!SAFE_METHODS.has(req.method.toUpperCase()) && req.headers[ADMIN_REQUEST_HEADER] !== '1') throw forbidden('Missing x-admin-request header');
}

/** Сессия админки из cookie или токена → request.user (AdminUser). Использовать с RolesGuard и @Roles на каждом эндпоинте. */
@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly sessions: AdminSessionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    assertAdminRequestHeader(req);
    if (!req.user) req.user = await this.sessions.resolve(sessionToken(req.headers), actingLocation(req.headers));
    return true;
  }
}
