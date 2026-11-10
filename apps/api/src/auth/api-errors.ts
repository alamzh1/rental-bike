import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';

// Ошибки API в формате { code, message }: `code` — ключ errors.<code> в packages/i18n, текст переводит клиент.
export const badRequest = (message: string) => new BadRequestException({ code: 'VALIDATION', message });
export const notFound = (message = 'Not found') => new NotFoundException({ code: 'NOT_FOUND', message });
export const unauthorized = (message = 'Unauthorized') => new UnauthorizedException({ code: 'UNAUTHORIZED', message });
export const forbidden = (message = 'Forbidden') => new ForbiddenException({ code: 'FORBIDDEN', message });
