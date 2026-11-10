import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { PricingModule } from '../pricing/pricing.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

// Модели, точки, опции, баннер. Фасад: CatalogService.listModels(filter), getModel(id).
@Module({
  imports: [AvailabilityModule, PricingModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
