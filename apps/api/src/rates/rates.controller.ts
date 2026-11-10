import { Controller, Get } from '@nestjs/common';
import type { RatesResponse } from '@rental/shared';
import { RatesService } from './rates.service';

@Controller('rates')
export class RatesController {
  constructor(private readonly rates: RatesService) {}

  /** GET /rates → { RUB, USD, updatedAt } — единиц валюты за 1 VND; без авторизации. */
  @Get()
  get(): Promise<RatesResponse> {
    return this.rates.info();
  }
}
