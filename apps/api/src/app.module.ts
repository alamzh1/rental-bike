import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ipRateLimit } from './auth/ip-rate-limit';
import { securityHeaders } from './auth/security-headers';
import { rejectNulBytes } from './app.nul-guard';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { AvailabilityModule } from './availability/availability.module';
import { PricingModule } from './pricing/pricing.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JobsModule } from './jobs/jobs.module';
import { DocumentsModule } from './documents/documents.module';
import { ManagerModule } from './manager/manager.module';
import { AdminModule } from './admin/admin.module';
import { ContractsModule } from './contracts/contracts.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RatesModule } from './rates/rates.module';
import { AuditModule } from './audit/audit.module';
import { FavoritesModule } from './favorites/favorites.module';
import { I18nModule } from './i18n/i18n.module';
import { GpsModule } from './gps/gps.module';

// Корневой модуль: создаётся таском 01. Таски наполняют только каталог своего модуля.
@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    CatalogModule,
    AvailabilityModule,
    PricingModule,
    BookingsModule,
    PaymentsModule,
    NotificationsModule,
    JobsModule,
    DocumentsModule,
    ManagerModule,
    AdminModule,
    ContractsModule,
    AnalyticsModule,
    RatesModule,
    AuditModule,
    FavoritesModule,
    I18nModule,
    GpsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(securityHeaders, ipRateLimit, rejectNulBytes).forRoutes('*');
  }
}
