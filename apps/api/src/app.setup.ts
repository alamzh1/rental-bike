import type { INestApplication } from '@nestjs/common';

/** Общая настройка приложения — для main.ts и тестов. Все маршруты под префиксом /api. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  return app;
}
