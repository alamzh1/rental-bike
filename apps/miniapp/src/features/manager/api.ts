import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActPhotoUploadResponse,
  BikePatchRequest,
  CashRequest,
  CashResponse,
  DocumentUrlResponse,
  HandoverRequest,
  HandoverResponse,
  ManagerBike,
  ManagerBookingDetail,
  ManagerTodayResponse,
  NoShowResponse,
  ReturnRequest,
  ReturnResponse,
} from '@rental/shared';
import { useApp } from '@/app/context';
import type { ApiClient } from '@/app/session/api';
import { DEFAULT_TIMEZONE } from '../catalog/api';

// Запросы режима менеджера. Ответы — типы из @rental/shared.

const ROOT = ['manager'] as const;

export function useToday() {
  const { api } = useApp();
  return useQuery({ queryKey: [...ROOT, 'today'], queryFn: () => api.request<ManagerTodayResponse>('/manager/today'), refetchInterval: 60_000 });
}

/** Часовой пояс точки менеджера (из «сегодня»). */
export function useManagerTimezone(): string {
  return useToday().data?.timezone ?? DEFAULT_TIMEZONE;
}

export function useManagerBikes() {
  const { api } = useApp();
  return useQuery({ queryKey: [...ROOT, 'bikes'], queryFn: () => api.request<ManagerBike[]>('/manager/bikes') });
}

/** Карточка брони по коду или ID; `poll` — опрашивать, пока клиент не подтвердил акт. */
export function useBookingDetail(ref: string) {
  const { api } = useApp();
  return useQuery({
    queryKey: [...ROOT, 'booking', ref],
    queryFn: () => api.request<ManagerBookingDetail>(`/manager/bookings/${encodeURIComponent(ref)}`),
    retry: false,
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && d.card.status === 'CONFIRMED' && d.issueAct && !d.issueAct.clientConfirmedAt ? 4000 : false;
    },
  });
}

/** Загрузка фото акта: ссылка на запись в приватный бакет → PUT файла → ключ для акта. */
export async function uploadActPhoto(api: ApiClient, bookingId: string, file: File): Promise<string> {
  const types = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
  const contentType = (types as readonly string[]).includes(file.type) ? (file.type as (typeof types)[number]) : 'image/jpeg';
  const up = await api.request<ActPhotoUploadResponse>(`/manager/bookings/${bookingId}/photos`, { method: 'POST', json: { contentType } });
  const res = await fetch(up.uploadUrl, { method: up.method, headers: up.headers, body: file });
  if (!res.ok) throw new Error('UPLOAD');
  return up.key;
}

export function useManagerActions(bookingId: string) {
  const { api } = useApp();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ROOT });
  const post = <T,>(path: string, json?: unknown) => api.request<T>(`/manager/bookings/${bookingId}/${path}`, { method: 'POST', json: json ?? {} });
  return {
    handover: useMutation({ mutationFn: (b: HandoverRequest) => post<HandoverResponse>('handover', b), onSuccess: refresh }),
    returnBike: useMutation({ mutationFn: (b: ReturnRequest) => post<ReturnResponse>('return', b), onSuccess: refresh }),
    cash: useMutation({ mutationFn: (b: CashRequest) => post<CashResponse>('cash', b), onSuccess: refresh }),
    noShow: useMutation({ mutationFn: () => post<NoShowResponse>('no-show'), onSuccess: refresh }),
    openDocument: async (id: string): Promise<string> => (await api.request<DocumentUrlResponse>(`/documents/${id}/url`)).url,
  };
}

export function usePatchBike() {
  const { api } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string } & BikePatchRequest) => api.request<ManagerBike>(`/manager/bikes/${v.id}`, { method: 'PATCH', json: { status: v.status, readyAt: v.readyAt } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROOT }),
  });
}
