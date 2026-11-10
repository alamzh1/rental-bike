import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { applyTrustProxy, trustProxySetting } from './auth/trust-proxy';
import { corsOrigin } from './auth/cors';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: { origin: corsOrigin() } });
  // За обратным прокси req.ip — адрес клиента из X-Forwarded-For (PAYOS_WEBHOOK_IPS, журнал). TRUST_PROXY, по умолчанию 'loopback'.
  applyTrustProxy(app);
  app.disable('x-powered-by');
  configureApp(app);

  // OpenAPI: /api/docs в dev; файл docs/openapi.json — `pnpm openapi`
  const config = new DocumentBuilder().setTitle('Аренда Байка API').setVersion('0.1.0').addBearerAuth().build();
  const document = SwaggerModule.createDocument(app, config);
  // В открытом запуске схема API не нужна: `pnpm public` работает как development, но виден из интернета
  if (process.env.NODE_ENV !== 'production' && process.env.API_DOCS !== 'off') SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.API_PORT ?? 3000);
  // Снаружи API доступен только через прокси или туннель; иначе его видит вся локальная сеть
  await app.listen(port, process.env.API_HOST || '127.0.0.1');
  Logger.log(`API: http://localhost:${port}/api/health (trust proxy: ${String(trustProxySetting())})`, 'Bootstrap');
}

void bootstrap();
