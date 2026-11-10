import { NavLink, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@rental/ui';
import { BikesScreen } from './BikesScreen';
import { BookingScreen } from './BookingScreen';
import { TodayScreen } from './TodayScreen';

function Tabs() {
  const { t } = useTranslation();
  const link = ({ isActive }: { isActive: boolean }) =>
    cn('hit-44 inline-flex h-control-sm items-center rounded-pill px-4 text-caption font-semibold', isActive ? 'bg-inverse text-on-inverse' : 'bg-surface text-ink');
  return (
    <nav aria-label={t('manager.tab.label')} className="flex gap-2">
      <NavLink to="/manager" end className={link}>
        {t('manager.tab.today')}
      </NavLink>
      <NavLink to="/manager/bikes" className={link}>
        {t('manager.tab.bikes')}
      </NavLink>
    </nav>
  );
}

/** Режим менеджера (MANAGER/ADMIN): /manager — сегодня и QR, /manager/booking/:code — бронь, /manager/bikes — парк. */
export default function ManagerScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5 px-4 pt-2">
      <Routes>
        <Route
          index
          element={
            <>
              <h1 className="m-0 text-title-1 text-balance">{t('manager.title')}</h1>
              <Tabs />
              <TodayScreen />
            </>
          }
        />
        <Route
          path="bikes"
          element={
            <>
              <h1 className="m-0 text-title-1 text-balance">{t('manager.title')}</h1>
              <Tabs />
              <BikesScreen />
            </>
          }
        />
        <Route path="booking/:code" element={<BookingScreen />} />
        <Route path="*" element={<TodayScreen />} />
      </Routes>
    </div>
  );
}
