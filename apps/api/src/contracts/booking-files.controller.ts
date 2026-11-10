import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Lang } from '@rental/shared';
import { notFound } from '../auth/api-errors';
import { bookingIcs } from '../bookings/ics';
import { PrismaService } from '../prisma/prisma.service';
import { ContractsService } from './contracts.service';
import { validFileSignature } from './file-link';

// Без сессии: доступ даёт подпись из POST /bookings/{id}/file-link. Неверная или просроченная ссылка → 404.
@Controller('booking-files')
export class BookingFilesController {
  constructor(
    private readonly contracts: ContractsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/:file')
  async file(@Param('id') id: string, @Param('file') file: string, @Query() q: Record<string, unknown>, @Res() res: Response): Promise<void> {
    const lang = String(q.lang ?? '');
    if (!validFileSignature(id, file, lang, Number(q.exp), String(q.sig ?? ''), Date.now())) throw notFound();
    const b = await this.prisma.booking.findUnique({ where: { id }, include: { model: { select: { name: true } }, location: true } });
    if (!b) throw notFound();
    if (file === 'contract') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${b.code}-contract.pdf"`);
      res.send(await this.contracts.render(id, lang as Lang));
      return;
    }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${b.code}.ics"`);
    res.send(bookingIcs({ id: b.id, code: b.code, modelName: b.model.name, startAt: b.startAt, endAt: b.endAt, address: b.location.address, lat: b.location.lat, lng: b.location.lng }));
  }
}
