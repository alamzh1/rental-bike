import { Logger, Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider';
import { PayOsProvider, payOsConfigFromEnv } from './payos-provider';
import { TestProvider, testProviderAllowed } from './test-provider';
import { DisabledProvider } from './disabled-provider';
import { LocationAccounts } from './location-accounts';

/**
 * Провайдер по .env (история 61): PAYOS_* заданы → payOS; без них тестовый — только при NODE_ENV=development|test,
 * иначе оплата выключена (POST /bookings/{id}/pay → 503, любой webhook → 400).
 */
export function createPaymentProvider(env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  const cfg = payOsConfigFromEnv(env);
  if (cfg) return new PayOsProvider(cfg);
  if (testProviderAllowed(env)) return new TestProvider();
  new Logger('Payments').error(`PAYOS_* не заданы при NODE_ENV=${env.NODE_ENV ?? ''} — онлайн-оплата выключена`);
  return new DisabledProvider();
}

// Платежи VietQR (payOS / тестовый), webhook, возвраты. Фасад: PaymentsService.markPaid(externalId, amount) — идемпотентно;
// recordRefund / completeRefund — для админки.
@Module({
  imports: [BookingsModule, AnalyticsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, LocationAccounts, { provide: PAYMENT_PROVIDER, useFactory: () => createPaymentProvider() }],
  exports: [PaymentsService, LocationAccounts, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
