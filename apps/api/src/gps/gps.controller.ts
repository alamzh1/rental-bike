import { All, Body, Controller, HttpCode, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GpsService } from './gps.service';

// Без сессии: трекер авторизуется секретом в адресе. Неизвестный секрет → 404.
@ApiTags('gps')
@Controller('gps')
export class GpsController {
  constructor(private readonly gps: GpsService) {}

  /** Traccar Server: forward.url = .../api/gps/forward?secret=…&id={uniqueId}&lat={latitude}&lon={longitude}&speed={speed}&timestamp={fixTime} */
  @All('forward')
  @HttpCode(200)
  async forward(@Query() q: Record<string, unknown>, @Body() body: unknown): Promise<{ ok: true }> {
    await this.gps.byDevice(q.secret, q.id, q, body);
    return { ok: true };
  }

  /** Устройство или приложение-трекер: адрес выдаётся администратору в карточке байка. */
  @All(':token')
  @HttpCode(200)
  async ingest(@Param('token') token: string, @Query() q: Record<string, unknown>, @Body() body: unknown): Promise<{ ok: true }> {
    await this.gps.byToken(token, q, body);
    return { ok: true };
  }
}
