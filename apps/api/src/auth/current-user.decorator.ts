import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './auth.types';

/** Пользователь из JwtAuthGuard (всегда есть) или OptionalJwtAuthGuard (может быть null). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | null => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthUser | null }>();
  return req.user ?? null;
});
