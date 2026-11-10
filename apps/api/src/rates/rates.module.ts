import { Module } from '@nestjs/common';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';
import { RATES_PROVIDER } from './rates.provider';

// Курсы VND→RUB/USD: раз в сутки из открытого источника без ключа, запасное значение — Setting `rates`. GET /api/rates.
@Module({
  controllers: [RatesController],
  providers: [RatesService, { provide: RATES_PROVIDER, useExisting: RatesService }],
  exports: [RatesService, RATES_PROVIDER],
})
export class RatesModule {}
