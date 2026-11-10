import type { Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { AlertService } from '../notifications/alert.service';

/**
 * Алерт администратору (история 87) из модулей, которые не могут импортировать NotificationsModule
 * без цикла (jobs — глобальный и нужен уведомлениям). AlertService берётся из контейнера лениво;
 * нет его (урезанный модуль в тестах) — остаётся запись в лог. Сбой отправки алерта не роняет вызывающего.
 */
export async function sendAlert(moduleRef: ModuleRef, log: Logger, text: string): Promise<void> {
  let alerts: AlertService | null = null;
  try {
    alerts = moduleRef.get(AlertService, { strict: false });
  } catch {
    alerts = null;
  }
  if (!alerts) {
    log.error(text);
    return;
  }
  try {
    await alerts.alert(text);
  } catch (e) {
    log.error(`${text} (алерт не отправлен: ${(e as Error).message})`);
  }
}
