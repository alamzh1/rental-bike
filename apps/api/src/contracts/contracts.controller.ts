import { Body, ConflictException, Controller, Get, Header, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AcceptContractResponse, BookingFileLinkResponse, Lang } from '@rental/shared';
import { badRequest, notFound } from '../auth/api-errors';
import { inScope, loadStaffScope } from '../auth/staff-scope';
import { writeAudit } from '../bookings/audit';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ContractsService } from './contracts.service';
import { signedFileUrl } from './file-link';

const LANGS: Lang[] = ['ru', 'en', 'vi'];
/** Договор подтверждают до выдачи или во время аренды. */
const ACCEPTABLE = ['CONFIRMED', 'ISSUED'];

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(
    private readonly contracts: ContractsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Договор видят клиент этой брони и сотрудники её точки: в нём имя, телефон и суммы. Чтение сотрудником пишется в журнал. */
  private async assertCanRead(user: AuthUser, id: string, b: { userId: string; locationId: string }): Promise<void> {
    if (b.userId === user.id) return;
    if (!inScope(await loadStaffScope(this.prisma, { id: user.id, role: user.role }), b.locationId)) throw notFound('Booking not found');
    await writeAudit(this.prisma, { id: user.id, role: user.role }, 'contract.read', 'Booking', id);
  }

  /** GET /bookings/{id}/contract?lang=ru|en|vi → PDF (язык + вьетнамская версия). Клиент — только своя бронь; менеджер/админ — любая. */
  @Get(':id/contract')
  @Header('Content-Type', 'application/pdf')
  async contract(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('lang') lang: string | undefined, @Res() res: Response): Promise<void> {
    const b = await this.prisma.booking.findUnique({ where: { id }, select: { code: true, userId: true, locationId: true } });
    if (!b) throw notFound('Booking not found');
    await this.assertCanRead(user, id, b);
    const pdf = await this.contracts.render(id, LANGS.includes(lang as Lang) ? (lang as Lang) : user.lang);
    res.setHeader('Content-Disposition', `inline; filename="${b.code}-contract.pdf"`);
    res.send(pdf);
  }

  /** POST /bookings/{id}/file-link: временная ссылка на договор или календарь — внутри Telegram файл открывается только по адресу. */
  @Post(':id/file-link')
  @HttpCode(200)
  async fileLink(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<BookingFileLinkResponse> {
    const b = await this.prisma.booking.findUnique({ where: { id }, select: { userId: true, locationId: true } });
    if (!b) throw notFound('Booking not found');
    await this.assertCanRead(user, id, b);
    const x = (body && typeof body === 'object' ? body : {}) as { file?: unknown; lang?: unknown };
    if (x.file !== 'contract' && x.file !== 'calendar') throw badRequest('file must be contract or calendar');
    const lang = LANGS.includes(x.lang as Lang) ? (x.lang as Lang) : user.lang;
    return { url: signedFileUrl(id, x.file, lang, Date.now()) };
  }

  /** POST /bookings/{id}/contract/accept — клиент подтверждает договор в приложении (ТЗ §11.1). Только своя бронь; повтор возвращает ту же отметку. */
  @Post(':id/contract/accept')
  @HttpCode(200)
  async accept(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<AcceptContractResponse> {
    const b = await this.prisma.booking.findUnique({ where: { id }, select: { userId: true, status: true, contractAcceptedAt: true } });
    if (!b || b.userId !== user.id) throw notFound('Booking not found');
    if (b.contractAcceptedAt) return { contractAcceptedAt: b.contractAcceptedAt.toISOString() };
    if (!ACCEPTABLE.includes(b.status)) throw new ConflictException({ code: 'INVALID_TRANSITION', message: `Contract cannot be accepted in status ${b.status}` });
    const saved = await this.prisma.booking.update({ where: { id }, data: { contractAcceptedAt: new Date() }, select: { contractAcceptedAt: true } });
    return { contractAcceptedAt: saved.contractAcceptedAt!.toISOString() };
  }
}
