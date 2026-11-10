import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, SearchX } from 'lucide-react';
import type { ManagerBookingCard } from '@rental/shared';
import { Badge, Button, EmptyState, Icon, Skeleton, useDelayedFlag } from '@rental/ui';
import { useApp } from '@/app/context';
import { MainAction } from '@/app/shell/MainAction';
import { useToday } from './api';
import { extractBookingCode } from './logic';
import { scanBookingQr } from './scan';
import { CONTROL, Section, useFormat } from './ui';

function CardRow({ card, kind }: { card: ManagerBookingCard; kind: 'issue' | 'return' }) {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const at = kind === 'issue' ? card.startAt : card.endAt;
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(`/manager/booking/${encodeURIComponent(card.code)}`)}
        className="flex min-h-[64px] w-full items-center gap-3 border-b border-line py-3 text-left"
      >
        <span className="w-14 flex-none text-headline tabular">{f.time(at)}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-strong tabular">{card.code}</span>
          <span className="break-words text-body text-ink-muted">
            {card.modelName} · <span className="tabular">{card.plate}</span>
          </span>
          <span className="truncate text-caption text-ink-muted">{card.clientName ?? card.phone ?? ''}</span>
        </span>
        <span className="flex flex-none flex-col items-end gap-1">
          {card.incidentOpen && <Badge tone="danger">{t('manager.today.incident')}</Badge>}
          {card.overdue && <Badge tone="danger">{t('manager.today.overdue')}</Badge>}
          {card.cashDue > 0 && <span className="text-caption font-bold tabular">{t('manager.today.cashDue', { amount: f.money(card.cashDue) })}</span>}
        </span>
        <Icon icon={ChevronRight} size={20} className="flex-none text-ink-muted" />
      </button>
    </li>
  );
}

function List({ title, empty, cards, kind }: { title: string; empty: string; cards: ManagerBookingCard[]; kind: 'issue' | 'return' }) {
  return (
    <Section title={`${title} · ${cards.length}`}>
      {cards.length === 0 ? (
        <p className="m-0 text-body text-ink-muted">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {cards.map((c) => (
            <CardRow key={c.id} card={c} kind={kind} />
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Сегодня: кнопка «Сканировать QR», поле для ввода кода, выдачи и возвраты на сегодня. */
export function TodayScreen() {
  const { t } = useTranslation();
  const { platform } = useApp();
  const navigate = useNavigate();
  const today = useToday();
  const [code, setCode] = useState('');
  const [scanNote, setScanNote] = useState(false);
  const showSkeleton = useDelayedFlag(today.isPending);

  const open = (raw: string) => {
    const c = extractBookingCode(raw);
    if (c) navigate(`/manager/booking/${encodeURIComponent(c)}`);
  };
  const scan = async () => {
    setScanNote(false);
    const r = await scanBookingQr(platform, t('manager.scan.prompt'));
    if (r.code) open(r.code);
    else if (r.unsupported) setScanNote(true);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    open(code);
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="manager-code" className="text-body-strong">
          {t('manager.code.label')}
        </label>
        <div className="flex gap-2">
          <input
            id="manager-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('manager.code.placeholder')}
            autoCapitalize="characters"
            autoComplete="off"
            enterKeyHint="go"
            className={`${CONTROL} h-control-md min-w-0 flex-1 tabular`}
          />
          <Button type="submit" variant="inverse" disabled={!extractBookingCode(code)}>
            {t('manager.code.submit')}
          </Button>
        </div>
        <p className="m-0 text-caption text-ink-muted">{scanNote ? t('manager.scan.failed') : t('manager.code.hint')}</p>
      </form>

      {today.isPending && (
        <div aria-busy="true" className="flex flex-col gap-3">
          {showSkeleton && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      )}
      {today.isError && <EmptyState tone="danger" icon={SearchX} title={t('errors.UNKNOWN')} action={{ label: t('manager.booking.retry'), onClick: () => void today.refetch() }} />}
      {today.data && (
        <>
          <List title={t('manager.today.issues')} empty={t('manager.today.emptyIssues')} cards={today.data.issues} kind="issue" />
          <List title={t('manager.today.returns')} empty={t('manager.today.emptyReturns')} cards={today.data.returns} kind="return" />
          {today.data.issues.length + today.data.returns.length === 0 && <p className="m-0 text-body text-ink-muted">{t('manager.today.emptyHint')}</p>}
        </>
      )}
      <MainAction text={t('manager.scan.button')} onClick={() => void scan()} />
    </div>
  );
}

