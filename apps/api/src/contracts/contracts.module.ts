import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { BookingFilesController } from './booking-files.controller';

// Договор аренды PDF (pdfkit, Noto Sans). Фасад: ContractsService.render(bookingId, lang): Promise<Buffer>; GET /bookings/{id}/contract.
@Module({
  controllers: [ContractsController, BookingFilesController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
