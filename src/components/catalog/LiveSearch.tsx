'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { MediaSummary } from '@/lib/catalog/types';
import { localePath } from '@/lib/i18n';
import { fmt } from '@/lib/utils';
import { useLocale } from '@/components/ui/LocaleProvider';
import CatalogGrid from './CatalogGrid';
import type { CardLabels } from './card-labels';

interface LiveSearchProps {
  labels: {
    label: string;
    placeholder: string;
    hint: string;
    searching: string;
    resultCount: string;
    none: string;
    error: string;
  };
  card: CardLabels;
}

const MIN_LENGTH = 2;
const DEBOUNCE_MS = 350;

type State = { status: 'idle' } | { status: 'loading' } | { status: 'error' } | { status: 'done'; items: MediaSummary[] };

/** Yazdıkça arar (debounce'lu). Sonuç sayısı aria-live ile duyurulur, sorgu URL'ye yazılır. */
export default function LiveSearch({ labels, card }: LiveSearchProps) {
  const router = useRouter();
  const locale = useLocale();
  const initial = useSearchParams().get('q') ?? '';
  const [query, setQuery] = useState(initial);
  const [state, setState] = useState<State>({ status: 'idle' });

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_LENGTH) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { items: MediaSummary[] };
        setState({ status: 'done', items: data.items });
        router.replace(localePath(locale, `/ara?q=${encodeURIComponent(trimmed)}`), { scroll: false });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setState({ status: 'error' });
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, router, locale]);

  const message =
    state.status === 'loading'
      ? labels.searching
      : state.status === 'error'
        ? labels.error
        : state.status === 'done'
          ? state.items.length > 0
            ? fmt(labels.resultCount, { n: state.items.length })
            : fmt(labels.none, { q: trimmed })
          : labels.hint;

  return (
    <div>
      <label htmlFor="live-search" className="mb-2 block text-sm font-semibold">
        {labels.label}
      </label>
      <input
        id="live-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={labels.placeholder}
        autoComplete="off"
        autoFocus
        maxLength={60}
        className="field !py-3 text-lg"
      />
      <p role="status" aria-live="polite" className="mt-3 text-sm font-semibold text-muted">
        {message}
      </p>
      {state.status === 'done' && state.items.length > 0 && (
        <div className="mt-8">
          <CatalogGrid items={state.items} labels={card} />
        </div>
      )}
    </div>
  );
}
