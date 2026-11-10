import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { DocumentsModule } from '../documents/documents.module';
import { HandoverClientController } from './handover-client.controller';
import { ManagerController } from './manager.controller';
import { ManagerService } from './manager.service';

// Режим менеджера: выдача и возврат по QR с фотоактом, наличные, «Не пришёл», ремонт, сверка документов.
// Только HTTP (`/manager/*`) + акты для клиента (`/bookings/:id/handover*`). Доступ к /manager — MANAGER/ADMIN.
@Module({
  imports: [BookingsModule, DocumentsModule],
  controllers: [ManagerController, HandoverClientController],
  providers: [ManagerService],
})
export class ManagerModule {}
