'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import Link from '@/components/ui/LocLink';
import type { Content } from '@/content';
import { cn, fmt } from '@/lib/utils';
import {
  LIST_STATUSES,
  exportEntries,
  importEntries,
  isMemoryOnly,
  removeEntry,
  retrySync,
  useSyncState,
  useWatchlist,
  type ListEntry,
} from '@/lib/watchlist';
import { localePath } from '@/lib/i18n';
import { useLocale } from '@/components/ui/LocaleProvider';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import CoverArt from './CoverArt';

type Tab = 'all' | 'favorites' | (typeof LIST_STATUSES)[number];

/** Listenin nerede saklandığını söyler: bu tarayıcıda mı, hesapta mı; senkron hatasında yeniden denetir. */
function SyncNotice({ content: l }: { content: Content['catalog']['list'] }) {
  const state = useSyncState();
  const locale = useLocale();

  if (state === 'local') {
    return (
      <p className="mb-6 text-sm text-muted">
        {l.syncLocal}{' '}
        <Link href={`/giris?callbackUrl=${encodeURIComponent(localePath(locale, '/listem'))}`} className="font-semibold text-primary-text hover:underline">
          {l.syncSignIn}
        </Link>
      </p>
    );
  }

  return (
    <p role="status" aria-live="polite" className={cn('mb-6 flex flex-wrap items-center gap-2 text-sm font-semibold', state === 'error' ? 'text-primary-text' : 'text-muted')}>
      <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', state === 'synced' ? 'bg-electric' : state === 'error' ? 'bg-primary' : 'animate-pulse bg-volt')} />
      {state === 'synced' ? l.syncSynced : state === 'syncing' ? l.syncSyncing : l.syncError}
      {state === 'error' && (
        <button type="button" onClick={retrySync} className="underline hover:no-underline">
          {l.syncRetry}
        </button>
      )}
    </p>
  );
}

export default function ListView({ content }: { content: Content['catalog'] }) {
  const l = content.list;
  const entries = useWatchlist();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>('all');
  const fileInput = useRef<HTMLInputElement>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: l.tabAll },
    { id: 'favorites', label: l.tabFavorites },
    ...LIST_STATUSES.map((status) => ({ id: status, label: content.watchlist[status] })),
  ];

  const visible = entries.filter((e) => (tab === 'all' ? true : tab === 'favorites' ? e.favorite : e.status === tab));

  const onExport = () => {
    const url = URL.createObjectURL(new Blob([exportEntries()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'listem.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const count = importEntries(await file.text());
    push(count === null ? l.importFail : fmt(l.importOk, { n: count }));
  };

  const onRemove = (entry: ListEntry) => {
    removeEntry(entry.id);
    push(fmt(content.watchlist.removed, { title: entry.title }));
  };

  return (
    <div>
      <div role="group" aria-label={l.tabsLabel} className="mb-8 flex flex-wrap gap-3">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition',
              tab === id ? 'border-transparent bg-primary text-white' : 'border-line bg-surface text-fg hover:bg-fg/5',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p role="status" aria-live="polite" className="font-bold">
          {fmt(l.count, { n: visible.length })}
        </p>
        <div className="flex flex-wrap gap-3 text-sm font-semibold">
          <button type="button" onClick={onExport} disabled={entries.length === 0} className="rounded-lg border border-line bg-surface px-3 py-1.5 hover:bg-fg/5 disabled:opacity-50">
            {l.export}
          </button>
          <button type="button" onClick={() => fileInput.current?.click()} className="rounded-lg border border-line bg-surface px-3 py-1.5 hover:bg-fg/5">
            {l.import}
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" onChange={onImport} className="sr-only" tabIndex={-1} aria-hidden="true" />
        </div>
      </div>

      <SyncNotice content={l} />

      {isMemoryOnly() && <p className="mb-6 rounded-lg bg-volt p-3 font-semibold text-ink">{l.storageWarning}</p>}

      {visible.length === 0 ? (
        <div className="flex flex-col items-start gap-5">
          <p className="text-lg text-muted">{l.empty}</p>
          <Button href="/anime">
            {l.browse}
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map((entry) => (
            <li key={entry.id}>
              <Link href={`/${entry.kind}/${entry.id}`} className="group block">
                <Card className="transition-transform group-hover:-translate-y-1">
                  <div className="relative aspect-[2/3] bg-night">
                    <CoverArt media={entry} sizes="(min-width: 1024px) 15vw, 45vw" />
                    {entry.favorite && (
                      <span aria-hidden="true" className="absolute right-2 top-2 z-10 rounded-md bg-primary px-1.5 text-white">
                        ♥
                      </span>
                    )}
                    {entry.status && (
                      <span className="absolute bottom-2 left-2 z-10 rounded-md bg-volt px-2 py-0.5 text-[0.65rem] font-bold text-ink">
                        {content.watchlist[entry.status]}
                      </span>
                    )}
                  </div>
                </Card>
                <p className="mt-3 line-clamp-2 font-bold leading-tight">{entry.title}</p>
              </Link>
              <button
                type="button"
                onClick={() => onRemove(entry)}
                className="mt-1 text-xs font-semibold text-primary-text hover:underline"
              >
                {l.remove}
                <span className="sr-only"> — {entry.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
