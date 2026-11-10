import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { GpsController } from './gps.controller';
import { GpsService } from './gps.service';

@Module({
  imports: [NotificationsModule],
  controllers: [GpsController],
  providers: [GpsService],
})
export class GpsModule {}
