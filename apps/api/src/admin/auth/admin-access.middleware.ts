import { Injectable, type NestMiddleware } from '@nestjs/common';
import { canCallAdminApi } from '@rental/shared';
import { forbidden } from '../../auth/api-errors';
import { actingLocation, AdminSessionService, sessionToken } from './admin-session.service';
import { assertAdminRequestHeader, type AdminRequest } from './admin-session.guard';

/**
 * Политика доступа ко всем /api/admin/* (включая разделы таска 11): сессия обязательна (кроме /admin/auth/*),
 * менеджеру открыты только сегменты из ADMIN_API_MANAGER_SEGMENTS — остальное 403 ещё до маршрутизации.
 */
@Injectable()
export class AdminAccessMiddleware implements NestMiddleware {
  constructor(private readonly sessions: AdminSessionService) {}

  async use(req: AdminRequest, _res: unknown, next: (e?: unknown) => void): Promise<void> {
    const path = (req.originalUrl ?? req.path ?? '').split('?')[0] ?? '';
    const segment = /\/admin\/([^/]+)/.exec(path)?.[1] ?? '';
    if (segment === 'auth') return next();
    assertAdminRequestHeader(req);
    const user = await this.sessions.resolve(sessionToken(req.headers), actingLocation(req.headers));
    if (!canCallAdminApi(user.role, segment)) throw forbidden();
    req.user = user;
    next();
  }
}
