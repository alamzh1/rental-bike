// Фасад модуля auth для других модулей.
export { AuthModule } from './auth.module';
export { AuthService } from './auth.service';
export { JwtAuthGuard, OptionalJwtAuthGuard } from './jwt-auth.guard';
export { CurrentUser } from './current-user.decorator';
export { Roles, RolesGuard } from './roles';
export type { AuthUser } from './auth.types';
export { staffScope, loadStaffScope, scopeWhere, scopeLocationId, inScope, type StaffScope } from './staff-scope';
export { badRequest, forbidden, notFound, unauthorized } from './api-errors';
