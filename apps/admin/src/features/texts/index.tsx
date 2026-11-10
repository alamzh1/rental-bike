import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { AdminSettings, AdminSettingsResponse, AdminTextList, AdminTextPatch, AdminTextRow, I18nText, Lang } from '@rental/shared';
import { Badge, Button, Chip, ChipGroup, EmptyState, Icon, Sheet } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, inputClass, PageHeader, Panel } from '@/app/ui';
import { DemoTag, I18nTextField, LANG_ORDER, LoadGate, textareaClass, useAdminGet, useAdminSave } from '@/features/fleet/kit';
import { filterTexts, namespaces } from './filter';

const DOCS = ['contractTemplate', 'rulesText', 'restrictionsText', 'privacyText', 'faq'] as const;
type DocKey = (typeof DOCS)[number];
const PAGE = 60;

/** Договор, правила, политика, FAQ — тексты на 3 языках в настройках (Mini App и PDF договора читают их сразу). */
function DocumentText({ k, values, demo }: { k: DocKey; values: AdminSettings; demo: boolean }) {
  const { t } = useTranslation();
  const [v, setV] = useState<Partial<I18nText>>(values[k] ?? {});
  const save = useAdminSave((text: Partial<I18nText>) => api.patch<AdminSettingsResponse>('/admin/settings', { [k]: text }), { success: t('admin-fleet.common.saved'), invalidate: ['/admin/settings'] });
  const dirty = JSON.stringify(v) !== JSON.stringify(values[k] ?? {});
  return (
    <Panel title={t(`admin-fleet.texts.doc.${k}`)} actions={<DemoTag show={demo} />}>
      <div className="flex flex-col gap-3">
        <I18nTextField label={t('admin-fleet.texts.docText')} value={v} onChange={setV} multiline rows={k === 'contractTemplate' ? 10 : 6} maxLength={50_000} hint={t(`admin-fleet.texts.docHint.${k}`)} />
        {save.error && <Alert>{save.error}</Alert>}
        <div className="flex justify-end">
          <Button variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || !v.en?.trim()} loading={save.isLoading} onClick={() => save.mutate(v)}>
            {t('admin-fleet.common.save')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function StringSheet({ row, onClose }: { row: AdminTextRow; onClose: () => void }) {
  const { t } = useTranslation();
  const [v, setV] = useState<Partial<Record<Lang, string>>>(() => Object.fromEntries(LANG_ORDER.map((l) => [l, row.override[l] ?? row.base[l]])));
  const save = useAdminSave(async (patches: AdminTextPatch[]) => {
    for (const p of patches) await api.patch<AdminTextRow>('/admin/texts', p);
  }, { success: t('admin-fleet.common.saved'), invalidate: ['/admin/texts'] });
  const patches: AdminTextPatch[] = LANG_ORDER.filter((l) => (v[l] ?? '') !== (row.override[l] ?? row.base[l])).map((l) => ({ lang: l, key: row.key, value: (v[l] ?? '').trim() === row.base[l] ? null : (v[l] ?? '') }));
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('admin-fleet.texts.editString')}
      closeLabel={t('admin.common.close')}
      className="sm:max-w-[640px]"
      footer={
        <Button block size="lg" disabled={!patches.length} loading={save.isLoading} onClick={() => save.mutate(patches, { onSuccess: onClose })}>
          {t('admin-fleet.common.save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="break-all text-caption text-ink-muted tabular">{row.key}</p>
        {save.error && <Alert>{save.error}</Alert>}
        {LANG_ORDER.map((l) => (
          <div key={l} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`str-${l}`} className="text-label uppercase text-ink-muted">
                {l}
              </label>
              {row.override[l] !== undefined && (
                <button type="button" className="text-caption text-accent-text underline-offset-4 hover:underline" onClick={() => setV({ ...v, [l]: row.base[l] })}>
                  {t('admin-fleet.texts.resetToBase')}
                </button>
              )}
            </div>
            <textarea id={`str-${l}`} rows={3} value={v[l] ?? ''} onChange={(e) => setV({ ...v, [l]: e.target.value })} className={textareaClass} />
            {(v[l] ?? '') !== row.base[l] && <span className="text-caption text-ink-muted">{t('admin-fleet.texts.base', { text: row.base[l] || '—' })}</span>}
          </div>
        ))}
        <p className="text-caption text-ink-muted">{t('admin-fleet.texts.placeholdersHint')}</p>
      </div>
    </Sheet>
  );
}

/** Тексты: документы (договор, правила, политика, FAQ) и правка строк интерфейса поверх JSON-переводов. */
export default function Texts() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const settings = useAdminGet<AdminSettingsResponse>('/admin/settings');
  const texts = useAdminGet<AdminTextList>('/admin/texts');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<AdminTextRow | null>(null);
  const ns = params.get('ns') ?? '';
  const onlyEdited = params.get('edited') === '1';
  const all = useMemo(() => texts.data?.items ?? [], [texts.data]);
  const spaces = useMemo(() => namespaces(all), [all]);
  const rows = useMemo(() => filterTexts(all, { q, ns, onlyEdited }), [all, q, ns, onlyEdited]);
  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
    setLimit(PAGE);
  };

  return (
    <>
      <PageHeader title={t('admin.nav.texts')} meta={t('admin-fleet.texts.meta')} />
      <div className="flex flex-col gap-8">
        <section aria-labelledby="docs-h" className="flex flex-col gap-4">
          <h2 id="docs-h" className="text-title-2">
            {t('admin-fleet.texts.documents')}
          </h2>
          <LoadGate isLoading={settings.isLoading} isError={settings.isError} onRetry={() => void settings.refetch()} rows={2}>
            {settings.data && (
              <div className="grid gap-4 xl:grid-cols-2">
                {DOCS.map((k) => (
                  <DocumentText key={`${k}-${JSON.stringify(settings.data!.values[k])}`} k={k} values={settings.data!.values} demo={settings.data!.demo.includes(k)} />
                ))}
              </div>
            )}
          </LoadGate>
        </section>

        <section aria-labelledby="strings-h" className="flex flex-col gap-4">
          <div>
            <h2 id="strings-h" className="text-title-2">
              {t('admin-fleet.texts.strings')}
            </h2>
            <p className="mt-1 max-w-[70ch] text-body text-ink-muted">{t('admin-fleet.texts.stringsText')}</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="relative max-w-xl">
              <Icon icon={Search} size={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <label htmlFor="texts-q" className="sr-only">
                {t('admin-fleet.texts.search')}
              </label>
              <input id="texts-q" type="search" value={q} placeholder={t('admin-fleet.texts.search')} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} className={`${inputClass} rounded-pill pl-10`} />
            </div>
            <ChipGroup label={t('admin-fleet.texts.sections')} scroll className="flex gap-2">
              <Chip selected={!ns && !onlyEdited} onClick={() => setParams('', { replace: true })}>
                {t('admin-fleet.texts.all')}
              </Chip>
              <Chip selected={onlyEdited} onClick={() => setParam('edited', onlyEdited ? '' : '1')}>
                {t('admin-fleet.texts.edited')}
              </Chip>
              {spaces.map((s) => (
                <Chip key={s} selected={ns === s} onClick={() => setParam('ns', ns === s ? '' : s)}>
                  {s}
                </Chip>
              ))}
            </ChipGroup>
          </div>
          <LoadGate isLoading={texts.isLoading} isError={texts.isError} onRetry={() => void texts.refetch()}>
            {rows.length === 0 ? (
              <EmptyState icon={Search} title={t('admin-fleet.texts.nothing')} text={t('admin-fleet.texts.nothingText')} className="py-10" />
            ) : (
              <>
                <p className="text-caption text-ink-muted tabular">{t('admin-fleet.texts.count', { count: rows.length })}</p>
                <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface-raised">
                  {rows.slice(0, limit).map((r) => (
                    <li key={r.key}>
                      <button type="button" onClick={() => setOpen(r)} className="grid w-full gap-1 px-4 py-3 text-left hover:bg-surface md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-4">
                        <span className="min-w-0 break-all text-caption text-ink-muted tabular">
                          {r.key}
                          {Object.keys(r.override).length > 0 && (
                            <span className="ml-2 inline-block align-middle">
                              <Badge tone="accent" plain>
                                {t('admin-fleet.texts.editedTag')}
                              </Badge>
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 text-body">{r.override.ru ?? r.base.ru ?? r.base.en}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {rows.length > limit && (
                  <Button variant="secondary" className="self-center" onClick={() => setLimit(limit + PAGE * 2)}>
                    {t('admin-fleet.texts.more', { count: rows.length - limit })}
                  </Button>
                )}
              </>
            )}
          </LoadGate>
        </section>
      </div>
      {open && <StringSheet row={open} onClose={() => setOpen(null)} />}
    </>
  );
}
