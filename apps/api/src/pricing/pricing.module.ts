import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';

// Тарифы и сезоны → shared.quote. Фасад: PricingService.quoteFor(modelId, from, to, extras, { delivery }).
@Module({
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
