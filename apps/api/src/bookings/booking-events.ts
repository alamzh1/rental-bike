import { Injectable, Logger } from '@nestjs/common';

// События броней для уведомлений (таск 06 подписывается: BookingEvents.subscribe) и аналитики.
export type BookingEventName =
  | 'created' // VietQR: ожидает оплаты
  | 'confirmed' // оплачено или наличные
  | 'payment_mismatch' // недоплата/переплата → «Проблема», уведомить менеджера
  | 'payment_after_cancel' // оплата пришла после отмены — нужен возврат
  | 'cancelled' // клиентом
  | 'expired' // не оплачено вовремя
  | 'no_show' // неявка
  | 'problem' // клиент сообщил о проблеме
  | 'status_changed'
  | 'refund_recorded' // создана запись возврата
  | 'refunded' // администратор отметил возврат
  | 'incident_opened' // байка нет на месте
  | 'incident_proposed' // точка предложила замену
  | 'incident_resolved'
  | 'bike_reassigned' // предыдущий клиент не вернул байк, бронь переставлена на другой
  | 'deposit_deducted' // удержание из депозита
  | 'rub_transfer_claimed' // клиент сообщил о переводе в рублях
  | 'rub_transfer_not_found'; // администратор не нашёл перевод

export interface BookingEvent {
  bookingId: string;
  name: BookingEventName;
  params?: Record<string, unknown>;
}

export type BookingEventListener = (e: BookingEvent) => void | Promise<void>;

@Injectable()
export class BookingEvents {
  private readonly log = new Logger('BookingEvents');
  private readonly listeners: BookingEventListener[] = [];

  subscribe(listener: BookingEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  /** Ошибки подписчиков не влияют на бронь. */
  emit(e: BookingEvent): void {
    for (const l of this.listeners) {
      Promise.resolve()
        .then(() => l(e))
        .catch((err: unknown) => this.log.error(`${e.name} ${e.bookingId}: ${(err as Error).message}`));
    }
  }
}
