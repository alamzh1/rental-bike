import type { ComponentType, ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom';
import type { Role } from '@rental/shared';
import HomeScreen from '@/features/home';
import { useApp } from './context';
import { Layout } from './shell/Layout';
import { Forbidden, NotFound } from './screens/NotFound';

// Маршруты Mini App. Главная — в первом чанке; остальные фичи — ленивые отдельные чанки.
// Маршрут фичи с «/*» — внутри фича может держать свои вложенные <Routes>.

type Lazy = () => Promise<{ default: ComponentType }>;
const lazy = (load: Lazy): RouteObject['lazy'] => async () => ({ Component: (await load()).default });

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { role } = useApp();
  return roles.includes(role) ? <>{children}</> : <Forbidden />;
}

/** Пути для навигации из фич. */
export const paths = {
  home: '/',
  dates: '/dates',
  catalog: '/catalog',
  bike: (modelId: string) => `/bikes/${modelId}`,
  favorites: '/favorites',
  checkout: (modelId: string) => `/checkout/${modelId}`,
  payment: (bookingId: string) => `/payment/${bookingId}`,
  bookings: '/bookings',
  booking: (bookingId: string) => `/bookings/${bookingId}`,
  profile: '/profile',
  documents: '/profile/documents',
  manager: '/manager',
} as const;

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'dates/*', lazy: lazy(() => import('@/features/dates')) },
      { path: 'catalog/*', lazy: lazy(() => import('@/features/catalog')) },
      { path: 'bikes/:modelId/*', lazy: lazy(() => import('@/features/bike')) },
      { path: 'favorites/*', lazy: lazy(() => import('@/features/favorites')) },
      { path: 'checkout/:modelId/*', lazy: lazy(() => import('@/features/checkout')) },
      { path: 'payment/:bookingId/*', lazy: lazy(() => import('@/features/payment')) },
      { path: 'bookings/*', lazy: lazy(() => import('@/features/bookings')) },
      { path: 'profile/documents/*', lazy: lazy(() => import('@/features/documents')) },
      { path: 'profile/*', lazy: lazy(() => import('@/features/profile')) },
      {
        path: 'manager',
        element: (
          <RequireRole roles={['MANAGER', 'OWNER', 'ADMIN']}>
            <Outlet />
          </RequireRole>
        ),
        children: [
          { index: true, lazy: lazy(() => import('@/features/manager')) },
          { path: '*', lazy: lazy(() => import('@/features/manager')) },
        ],
      },
      { path: 'index.html', element: <Navigate to="/" replace /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export function createRouter(startPath: string | null) {
  const router = createBrowserRouter(routes, {
    future: { v7_relativeSplatPath: true, v7_fetcherPersist: true, v7_normalizeFormMethod: true, v7_partialHydration: true, v7_skipActionErrorRevalidation: true },
  });
  // Ссылка бота (startapp=booking_<id>) — поверх главной, чтобы «Назад» вела домой.
  if (startPath && router.state.location.pathname === '/') void router.navigate(startPath);
  return router;
}
