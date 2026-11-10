import { Module } from '@nestjs/common';
import { LocalStorage } from './local-storage';
import { S3Storage } from './s3-storage';
import { storageDriver } from './config';
import { STORAGE, type Storage } from './storage';

export function createStorage(env: NodeJS.ProcessEnv = process.env): Storage {
  return storageDriver(env) === 's3' ? new S3Storage(env) : new LocalStorage(env);
}

// Отдельно от DocumentsModule: брони проверяют файлы документов, а документы зависят от броней.
@Module({
  providers: [{ provide: STORAGE, useFactory: () => createStorage() }],
  exports: [STORAGE],
})
export class StorageModule {}
