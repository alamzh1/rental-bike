import { Global, Module } from '@nestjs/common';
import { Clock } from './clock';
import { JobsService } from './jobs.service';

// BullMQ-очереди. Фасад: JobsService.scheduleHoldExpiry(bookingId, at), scheduleReminders(bookingId), cancelForBooking(bookingId);
// register/every — обработчики модулей-владельцев. Clock — текущее время (подменяется в тестах).
@Global()
@Module({
  providers: [JobsService, Clock],
  exports: [JobsService, Clock],
})
export class JobsModule {}
