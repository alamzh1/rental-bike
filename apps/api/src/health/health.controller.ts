import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@rental/shared';

@Controller('health')
export class HealthController {
  @Get()
  get(): HealthResponse {
    return { status: 'ok' };
  }
}
