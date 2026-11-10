import { Module } from '@nestjs/common';
import { StorageModule } from '../documents/storage/storage.module';
import { PricingModule } from '../pricing/pricing.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingEvents } from './booking-events';
import { IncidentsService } from './incidents.service';
import { RateLimiter } from './rate-limit';

// Брони: создание с резервом байка, статусы, отмена, неявка. Фасад: BookingsService.create / transition / cancel / markNoShow;
// BookingEvents.subscribe — события для уведомлений; RateLimiter — 10/мин на пользователя.
@Module({
  imports: [PricingModule, StorageModule],
  controllers: [BookingsController],
  providers: [BookingsService, IncidentsService, BookingEvents, RateLimiter],
  exports: [BookingsService, IncidentsService, BookingEvents, RateLimiter],
})
export class BookingsModule {}
