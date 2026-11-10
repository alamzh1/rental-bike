import { Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

// Занятость байков: брони с буфером, ремонт. Фасад: AvailabilityService.freeBikeCount / busyDates / busyUntil.
@Module({
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
