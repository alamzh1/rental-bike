import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { FilesController } from './files.controller';
import { StorageModule, createStorage } from './storage/storage.module';

export { createStorage };

// Документы клиентов и хранилище файлов. Фасад: STORAGE (Storage: presignPut / presignGet ≤ 600 с / delete / publicUrl),
// DocumentsService.signedUrl / verify / cleanup.
@Module({
  imports: [BookingsModule, StorageModule],
  controllers: [DocumentsController, FilesController],
  providers: [DocumentsService],
  exports: [DocumentsService, StorageModule],
})
export class DocumentsModule {}
