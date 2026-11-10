import { isQrScannerSupported, openQrScanner } from '@telegram-apps/sdk-react';
import type { Platform } from '@/app/platform';
import { extractBookingCode } from './logic';

/**
 * Сканер QR брони: окно камеры Telegram (showScanQrPopup / web_app_open_scan_qr_popup).
 * Вне Telegram или без поддержки клиентом → null: экран предлагает ввод кода. Окно закрыто без кода → null.
 */
export async function scanBookingQr(platform: Pick<Platform, 'kind'>, text: string): Promise<{ code: string | null; unsupported: boolean }> {
  if (platform.kind !== 'telegram') return { code: null, unsupported: true };
  try {
    if (!isQrScannerSupported()) return { code: null, unsupported: true };
    const qr = await openQrScanner({ text, capture: (value) => extractBookingCode(value) !== null });
    return { code: qr ? extractBookingCode(qr) : null, unsupported: false };
  } catch {
    return { code: null, unsupported: true };
  }
}
