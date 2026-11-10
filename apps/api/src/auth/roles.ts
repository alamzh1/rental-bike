import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@rental/shared';
import type { AuthUser } from './auth.types';
import { forbidden, unauthorized } from './api-errors';

const ROLES_KEY = 'roles';

/** Разрешённые роли. Использовать вместе с JwtAuthGuard: `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('MANAGER', 'ADMIN')`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: AuthUser | null }>().user;
    if (!user) throw unauthorized();
    if (!roles.includes(user.role)) throw forbidden();
    return true;
  }
}
