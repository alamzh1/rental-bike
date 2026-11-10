import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ClipboardCheck, FileCheck2, HelpCircle, LifeBuoy, ScrollText, ShieldCheck } from 'lucide-react';
import { Badge, Chip, ChipGroup, Icon, Sheet, Skeleton } from '@rental/ui';
import { pickText } from '@rental/i18n';
import type { Currency, HomeResponse, Lang, MeUser } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { paths } from '@/app/router';
import { contactHref, usePublicSettings } from './settings';

const LANGS: Lang[] = ['ru', 'en', 'vi'];
const CURRENCIES: Currency[] = ['VND', 'RUB', 'USD'];
type Info = 'faq' | 'rules' | 'privacy';
const INFOS: Array<{ key: Info; icon: typeof HelpCircle }> = [
  { key: 'faq', icon: HelpCircle },
  { key: 'rules', icon: ScrollText },
  { key: 'privacy', icon: ShieldCheck },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="m-0 text-title-2">{title}</h2>
      {children}
    </section>
  );
}

function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const haptic = useHaptic();
  const { api, user, role, setLang, updateMe } = useApp();
  const settings = usePublicSettings();
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState(false);

  const home = useQuery({ queryKey: ['home-tz'], queryFn: () => api.request<HomeResponse>('/home'), staleTime: 10 * 60_000 });

  const info = INFOS.find((i) => i.key === params.get('info'))?.key ?? null;
  const closeInfo = () => setParams((p) => { p.delete('info'); return p; }, { replace: true });
  const infoText = info ? settings.data?.[info === 'faq' ? 'faq' : info === 'rules' ? 'rulesText' : 'privacyText'] : null;
  const support = contactHref(settings.data?.managerContact);

  const apply = async (fn: () => Promise<unknown>) => {
    haptic.selection();
    setError(false);
    try {
      await fn();
    } catch {
      setError(true);
    }
  };

  // Статус меняет менеджер, поэтому читаем свежий, а не сохранённый при входе
  const me = useQuery({ queryKey: ['me'], queryFn: () => api.request<MeUser>('/me'), staleTime: 0 });
  const verified = me.data?.verificationStatus ?? user.verificationStatus;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  const tz = home.data?.location?.timezone;

  return (
    <div className="flex flex-col gap-6 px-4 pt-4">
      <header className="flex items-center gap-4">
        {user.photoUrl ? (
          <img src={user.photoUrl} alt="" className="h-16 w-16 rounded-full bg-surface object-cover" />
        ) : (
          <div aria-hidden className="grid h-16 w-16 place-items-center rounded-full bg-surface text-title-2 text-ink-muted">{name.slice(0, 1).toUpperCase()}</div>
        )}
        <div className="min-w-0">
          <h1 className="m-0 break-words text-title-1">{name}</h1>
          <p className="m-0 break-words text-body text-ink-muted">
            {user.username ? `@${user.username}` : ''}
            {user.username && user.phone ? ' · ' : ''}
            <span className="tabular">{user.phone ?? ''}</span>
          </p>
        </div>
      </header>

      <Link to={paths.documents} className="flex min-h-control-lg items-center gap-3 rounded-lg bg-surface px-4 py-3">
        <Icon icon={FileCheck2} size={24} className="text-ink-muted" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-body-strong">{t('profile.documents.title')}</span>
          <span>
            <Badge tone={verified === 'VERIFIED' ? 'success' : verified === 'REJECTED' ? 'danger' : verified === 'PENDING' ? 'warning' : 'neutral'}>
              {t(`profile.documents.status.${verified}`)}
            </Badge>
          </span>
        </span>
        <Icon icon={ChevronRight} size={20} className="text-ink-muted" />
      </Link>

      {(role === 'MANAGER' || role === 'OWNER' || role === 'ADMIN') && (
        <Link to={paths.manager} className="flex min-h-control-lg items-center gap-3 rounded-lg bg-inverse px-4 py-3 text-on-inverse">
          <Icon icon={ClipboardCheck} size={24} />
          <span className="flex-1 text-body-strong">{t('profile.manager.title')}</span>
          <Icon icon={ChevronRight} size={20} />
        </Link>
      )}

      <Section title={t('profile.language.title')}>
        <ChipGroup label={t('profile.language.title')}>
          {LANGS.map((l) => (
            <Chip key={l} variant="option" selected={lang === l} onClick={() => void apply(() => setLang(l))}>
              {t(`common.languages.${l}`)}
            </Chip>
          ))}
        </ChipGroup>
      </Section>

      <Section title={t('profile.currency.title')}>
        <ChipGroup label={t('profile.currency.title')}>
          {CURRENCIES.map((c) => (
            <Chip key={c} variant="option" selected={user.currency === c} onClick={() => void apply(() => updateMe({ currency: c }))}>
              {t(`profile.currency.${c}`)}
            </Chip>
          ))}
        </ChipGroup>
        <p className="m-0 text-caption text-ink-muted">{t('profile.currency.note')}</p>
      </Section>

      <Section title={t('profile.timezone.title')}>
        {tz ? <p className="tabular m-0 text-body">{tz}</p> : <Skeleton shape="text" className="w-1/2" />}
        <p className="m-0 text-caption text-ink-muted">{t('profile.timezone.note')}</p>
      </Section>

      {error && <p role="alert" className="m-0 text-caption text-danger">{t('errors.UNKNOWN')}</p>}

      <Section title={t('profile.help.title')}>
        <ul className="m-0 flex list-none flex-col p-0">
          {INFOS.map(({ key, icon }) => (
            <li key={key} className="border-b border-line last:border-b-0">
              <button type="button" onClick={() => setParams({ info: key }, { replace: true })} className="flex min-h-control-lg w-full items-center gap-3 py-2 text-left">
                <Icon icon={icon} size={20} className="text-ink-muted" />
                <span className="flex-1 text-body-strong">{t(`profile.help.${key}`)}</span>
                <Icon icon={ChevronRight} size={20} className="text-ink-muted" />
              </button>
            </li>
          ))}
          <li>
            {support ? (
              <a href={support} target="_blank" rel="noopener noreferrer" className="flex min-h-control-lg items-center gap-3 py-2">
                <Icon icon={LifeBuoy} size={20} className="text-ink-muted" />
                <span className="flex-1 text-body-strong">{t('profile.help.support')}</span>
                <Icon icon={ChevronRight} size={20} className="text-ink-muted" />
              </a>
            ) : (
              <p className="m-0 flex min-h-control-lg items-center gap-3 py-2 text-ink-muted">
                <Icon icon={LifeBuoy} size={20} />
                <span className="text-body">{t('profile.help.supportPlaceholder')}</span>
              </p>
            )}
          </li>
        </ul>
      </Section>

      <Sheet open={!!info} onClose={closeInfo} title={info ? t(`profile.help.${info}`) : ''} closeLabel={t('common.actions.close')}>
        {settings.isLoading ? (
          <Skeleton className="h-[128px] w-full" />
        ) : infoText ? (
          <p className="m-0 whitespace-pre-line pb-4 text-body">{pickText(infoText, lang)}</p>
        ) : (
          <p className="m-0 pb-4 text-body text-ink-muted">{t('profile.help.placeholder')}</p>
        )}
      </Sheet>
    </div>
  );
}

export default ProfileScreen;
