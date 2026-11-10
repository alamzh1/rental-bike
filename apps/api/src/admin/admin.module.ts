import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BookingsModule } from '../bookings/bookings.module';
import { DocumentsModule } from '../documents/documents.module';
import { AdminAccessMiddleware } from './auth/admin-access.middleware';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminSessionGuard } from './auth/admin-session.guard';
import { AdminSessionService } from './auth/admin-session.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { AdminActsController, AdminBookingsController } from './bookings/admin-bookings.controller';
import { SupervisionController } from './supervision/supervision.controller';
import { SupervisionService } from './supervision/supervision.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminDocumentsController } from './documents/admin-documents.controller';
import { AdminDocumentsService } from './documents/admin-documents.service';
import { AdminBookingsService } from './bookings/admin-bookings.service';
import { ChessController } from './chess/chess.controller';
import { ChessService } from './chess/chess.service';
import { AuditController } from './audit/audit.controller';
import { PaymentsModule } from '../payments/payments.module';
import { RatesModule } from '../rates/rates.module';
import { AdminBikesController, AdminBrandsController, AdminModelsController } from './fleet/fleet.controller';
import { FleetService } from './fleet/fleet.service';
import { AdminExtrasController, AdminSeasonsController, AdminTariffsController } from './prices/prices.controller';
import { PricesService } from './prices/prices.service';
import { AdminLocationsController } from './locations/locations.controller';
import { LocationsService } from './locations/locations.service';
import { AdminTextsController } from './texts/texts.controller';
import { TextsService } from './texts/texts.service';
import { AdminPaymentsController } from './payments/admin-payments.controller';
import { AdminPaymentsService } from './payments/admin-payments.service';
import { AdminSettingsController, PublicSettingsController } from './settings/settings.controller';
import { SettingsService } from './settings/settings.service';
import { AdminBannerController } from './banner/banner.controller';
import { BannerService } from './banner/banner.service';
import { AdminFinanceController } from './finance/finance.controller';
import { FinanceService } from './finance/finance.service';
import { AdminTrackingController } from './tracking/tracking.controller';
import { TrackingService } from './tracking/tracking.service';

// Веб-админка (только HTTP). Таск 10: вход (Login Widget → cookie), роли, дашборд, брони, шахматка, журнал.
// Таск 11: парк (models, bikes, brands), цены (tariffs, seasons, extras), точки, тексты, платежи, настройки, баннер
// и публичный GET /settings/public (без сессии — вне admin/*); AdminAccessMiddleware закрывает менеджеру всё вне ADMIN_API_MANAGER_SEGMENTS.
@Module({
  imports: [JwtModule.register({}), BookingsModule, DocumentsModule, PaymentsModule, RatesModule, NotificationsModule],
  controllers: [
    AdminAuthController,
    DashboardController,
    AdminBookingsController,
    AdminActsController,
    SupervisionController,
    ChessController,
    AuditController,
    AdminBrandsController,
    AdminModelsController,
    AdminBikesController,
    AdminTariffsController,
    AdminSeasonsController,
    AdminExtrasController,
    AdminLocationsController,
    AdminTextsController,
    AdminPaymentsController,
    AdminDocumentsController,
    AdminSettingsController,
    PublicSettingsController,
    AdminBannerController,
    AdminFinanceController,
    AdminTrackingController,
  ],
  providers: [AdminDocumentsService, SupervisionService, 
    AdminSessionService,
    AdminSessionGuard,
    AdminAccessMiddleware,
    DashboardService,
    AdminBookingsService,
    ChessService,
    FleetService,
    PricesService,
    LocationsService,
    TextsService,
    AdminPaymentsService,
    SettingsService,
    BannerService,
    FinanceService,
    TrackingService,
  ],
  exports: [AdminSessionService, AdminSessionGuard],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AdminAccessMiddleware).forRoutes({ path: 'admin/*', method: RequestMethod.ALL });
  }
}
