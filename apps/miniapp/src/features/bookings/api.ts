import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Booking, BookingFileLinkResponse, BookingListResponse } from '@rental/shared';
import { useApp } from '@/app/context';
import { API_BASE } from '@/app/env';
import { pollInterval } from './status';

export function useBookings() {
  const { api } = useApp();
  return useQuery({ queryKey: ['bookings'], queryFn: () => api.request<BookingListResponse>('/bookings') });
}

/** Бронь по id; пока ждёт оплаты — обновляется раз в 3 с (оплату подтверждает webhook, кнопки «Я оплатил» нет). */
export function useBooking(id: string) {
  const { api } = useApp();
  return useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.request<Booking>(`/bookings/${id}`),
    refetchInterval: (q) => (q.state.data ? pollInterval(q.state.data.status) : false),
    refetchIntervalInBackground: false,
  });
}

export function useRefreshBookings() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ['bookings'] });
    if (id) void qc.invalidateQueries({ queryKey: ['booking', id] });
  };
}

/** Текущее время, тикает раз в секунду: для таймеров. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Файл брони (договор, .ics). В браузере — скачивание с Bearer-токеном. В окне Telegram скачивание blob молча не работает,
 * поэтому там API выдаёт временную подписанную ссылку, и файл открывается системным браузером.
 */
export function useBookingFile() {
  const { api, token, platform } = useApp();
  return async (bookingId: string, file: 'contract' | 'calendar', lang: string, filename: string): Promise<void> => {
    if (platform.inTelegram) {
      const { url } = await api.request<BookingFileLinkResponse>(`/bookings/${bookingId}/file-link`, { method: 'POST', json: { file, lang } });
      platform.openLink(url);
      return;
    }
    const path = file === 'contract' ? `/bookings/${bookingId}/contract?lang=${lang}` : `/bookings/${bookingId}/calendar.ics`;
    const res = await fetch(`${API_BASE}${path}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(String(res.status));
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
}
