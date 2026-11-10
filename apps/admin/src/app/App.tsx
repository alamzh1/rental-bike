import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { Authenticated, Refine, useGetIdentity } from '@refinedev/core';
import routerBindings from '@refinedev/react-router-v6';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { SearchX } from 'lucide-react';
import type { AdminMe, AdminSection } from '@rental/shared';
import { EmptyState, Skeleton } from '@rental/ui';
import { accessControlProvider, authProvider, dataProvider } from './providers';
import { getI18n } from './i18n';
import { Layout } from './Layout';
import { Login } from './Login';
import { SectionGate } from './Gate';
import { MeContext, ToastHost } from './ui';
import { SECTION_NAV } from './sections';

// Разделы — ленивые чанки features/<section>/index.tsx (default export). Таск 11 наполняет свои папки, роутер не трогает.
const screens: Record<AdminSection, LazyExoticComponent<ComponentType>> = {
  dashboard: lazy(() => import('@/features/dashboard')),
  bookings: lazy(() => import('@/features/bookings')),
  chess: lazy(() => import('@/features/chess')),
  tracking: lazy(() => import('@/features/tracking')),
  fleet: lazy(() => import('@/features/fleet')),
  finance: lazy(() => import('@/features/finance')),
  prices: lazy(() => import('@/features/prices')),
  locations: lazy(() => import('@/features/locations')),
  payments: lazy(() => import('@/features/payments')),
  texts: lazy(() => import('@/features/texts')),
  settings: lazy(() => import('@/features/settings')),
  banner: lazy(() => import('@/features/banner')),
  audit: lazy(() => import('@/features/audit')),
  owners: lazy(() => import('@/features/owners')),
  acts: lazy(() => import('@/features/acts')),
  documents: lazy(() => import('@/features/documents')),
};
const BookingDetail = lazy(() => import('@/features/bookings/Detail'));
const BikeDetail = lazy(() => import('@/features/tracking/Detail'));

function PageSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function Splash() {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" className="flex min-h-dvh items-center justify-center bg-bg text-caption text-ink-muted">
      {t('admin.common.loading')}
    </div>
  );
}

/** Сессия есть: сотрудник в контексте, каркас и разделы. */
function Shell() {
  const { data: me } = useGetIdentity<AdminMe>();
  if (!me) return <Splash />;
  return (
    <MeContext.Provider value={me}>
      <Layout />
    </MeContext.Provider>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return <EmptyState icon={SearchX} title={t('admin.notFound.title')} text={t('admin.notFound.text')} className="py-16" />;
}

const page = (section: AdminSection, Screen: ComponentType) => (
  <SectionGate section={section}>
    <Suspense fallback={<PageSkeleton />}>
      <Screen />
    </Suspense>
  </SectionGate>
);

export function App() {
  return (
    <I18nextProvider i18n={getI18n()}>
      <BrowserRouter>
        <Refine
          routerProvider={routerBindings}
          dataProvider={dataProvider}
          authProvider={authProvider}
          accessControlProvider={accessControlProvider}
          resources={SECTION_NAV.map((n) => ({ name: n.section, list: n.path, ...(n.section === 'bookings' ? { show: '/bookings/:id' } : {}) }))}
          options={{ disableTelemetry: true, reactQuery: { clientConfig: { defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } } } }}
        >
          <ToastHost>
            <Routes>
              <Route
                path="/login"
                element={
                  <Authenticated key="login" fallback={<Login />} loading={<Splash />}>
                    <Navigate to="/" replace />
                  </Authenticated>
                }
              />
              <Route
                element={
                  <Authenticated key="app" redirectOnFail="/login" loading={<Splash />}>
                    <Outlet />
                  </Authenticated>
                }
              >
                <Route element={<Shell />}>
                  {SECTION_NAV.map((n) => (
                    <Route key={n.section} path={n.path} element={page(n.section, screens[n.section])} />
                  ))}
                  <Route path="/bookings/:id" element={page('bookings', BookingDetail)} />
                  <Route path="/tracking/:id" element={page('tracking', BikeDetail)} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </ToastHost>
        </Refine>
      </BrowserRouter>
    </I18nextProvider>
  );
}
