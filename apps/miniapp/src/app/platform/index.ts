import { isTMA } from '@telegram-apps/sdk-react';
import type { Role } from '@rental/shared';
import { resolveLaunchMode, type LaunchMode } from './launch';
import { createTelegramPlatform } from './telegram';
import type { Platform } from './types';

export type { Platform, ColorScheme, MainButtonParams } from './types';
export { resolveLaunchMode, startParamToPath, versionAtLeast, type LaunchMode } from './launch';

export interface DetectedPlatform {
  mode: LaunchMode;
  platform: Platform | null;
  devRole?: Role;
}

/** Определяет окружение. Браузерный модуль подгружается только в dev-режиме отдельным чанком. */
export async function detectPlatform(devAuth: boolean): Promise<DetectedPlatform> {
  if (isTMA()) {
    try {
      const platform = createTelegramPlatform();
      const mode = resolveLaunchMode({ initData: platform.initData, devAuth: false });
      return { mode, platform: mode === 'telegram' ? platform : null };
    } catch {
      // параметры запуска повреждены — как вне Telegram
    }
  }
  const mode = resolveLaunchMode({ initData: undefined, devAuth });
  if (mode !== 'dev') return { mode, platform: null };
  const { createBrowserPlatform } = await import('./browser');
  const platform = createBrowserPlatform();
  return { mode, platform, devRole: platform.devRole };
}
