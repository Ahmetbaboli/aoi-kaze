'use client';

import type { MediaSummary } from '@/lib/catalog/types';
import { fmt } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { LIST_STATUSES, setProgress, setStatus, toggleFavorite, useWatchlist, type ListStatus } from '@/lib/watchlist';
import { useToast } from '@/components/ui/Toast';

interface WatchlistControlsProps {
  media: Pick<MediaSummary, 'id' | 'kind' | 'title' | 'cover' | 'color'> & { total?: number | null; genres?: string[] };
  labels: Record<string, string>;
  /** Toplam bölüm sayısı (biliniyorsa); ilerleme sayacının üst sınırı */
  total?: number | null;
}

/** Durum seçici + favori düğmesi. Veriler tarayıcıda tutulur; giriş yapılmışsa hesapla senkronlanır. */
export default function WatchlistControls({ media, labels, total }: WatchlistControlsProps) {
  const entries = useWatchlist();
  const { push } = useToast();
  const entry = entries.find((e) => e.id === media.id);
  const favorite = entry?.favorite ?? false;

  const onStatus = (value: string) => {
    const status = value === '' ? null : (value as ListStatus);
    setStatus(media, status);
    push(fmt(status ? labels.saved : labels.removed, { title: media.title }));
  };

  const onFavorite = () => {
    toggleFavorite(media);
    push(fmt(favorite ? labels.favRemoved : labels.favAdded, { title: media.title }));
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-48">
        <label htmlFor="list-status" className="mb-1 block text-sm font-semibold">
          {labels.statusLabel}
        </label>
        <select
          id="list-status"
          value={entry?.status ?? ''}
          onChange={(event) => onStatus(event.target.value)}
          className="field"
        >
          <option value="">{labels.none}</option>
          {LIST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {labels[status]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={onFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? labels.unfavorite : labels.favorite}
        title={favorite ? labels.unfavorite : labels.favorite}
        className={cn(
          'flex h-[2.6rem] w-[2.6rem] items-center justify-center rounded-lg border transition',
          favorite ? 'border-transparent bg-primary text-white' : 'border-line bg-surface text-fg hover:bg-fg/5',
        )}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M12 21s-8-5.2-8-11a4.6 4.6 0 0 1 8-3 4.6 4.6 0 0 1 8 3c0 5.800-8 11-8 11Z" />
        </svg>
      </button>
      {entry?.status === 'current' && (
        <div className="flex items-center gap-1" role="group" aria-label={labels.progress}>
          <button
            type="button"
            aria-label={labels.progressDown}
            disabled={(entry.progress ?? 0) <= 0}
            onClick={() => setProgress(media, (entry.progress ?? 0) - 1)}
            className="flex h-[2.6rem] w-9 items-center justify-center rounded-lg border border-line bg-surface text-lg hover:bg-fg/5 disabled:opacity-40"
          >
            −
          </button>
          <span role="status" aria-live="polite" className="min-w-16 text-center text-sm font-semibold tabular-nums">
            {labels.progress}: {entry.progress ?? 0}
            {total ? ` / ${total}` : ''}
          </span>
          <button
            type="button"
            aria-label={labels.progressUp}
            disabled={total ? (entry.progress ?? 0) >= total : false}
            onClick={() => setProgress(media, (entry.progress ?? 0) + 1)}
            className="flex h-[2.6rem] w-9 items-center justify-center rounded-lg border border-line bg-surface text-lg hover:bg-fg/5 disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
