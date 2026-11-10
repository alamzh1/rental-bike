// Фасад входа в админку для разделов таска 11: `@UseGuards(AdminSessionGuard, RolesGuard) @Roles('ADMIN')`,
// пользователь — `@CurrentUser() user: AdminUser`. Политика сегментов /api/admin/* — canCallAdminApi (packages/shared).
export { AdminSessionGuard, assertAdminRequestHeader, type AdminRequest } from './admin-session.guard';
export { AdminSessionService, ADMIN_COOKIE, adminDevAuthEnabled, adminLocalDevAuth, displayName, type AdminUser } from './admin-session.service';
export { AdminAccessMiddleware } from './admin-access.middleware';
export { verifyLoginWidget, LoginWidgetError } from './login-widget';
