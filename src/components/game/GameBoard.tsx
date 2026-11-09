'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState, useTransition } from 'react';
import type { Content } from '@/content';
import type { MediaSummary } from '@/lib/catalog/types';
import { guessAction } from '@/lib/game/actions';
import type { PublicPlayState } from '@/lib/game/game-core';
import { CLUE_ORDER, MAX_GUESSES, shareText, type ClueKey } from '@/lib/game/game-logic';
import { cn, fmt } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Link from '@/components/ui/LocLink';

interface GameBoardProps {
  state: PublicPlayState;
  signedIn: boolean;
  loginHref: string;
  content: Content['game'];
  formats: Record<string, string>;
  genres: Record<string, string>;
  /** Önceki tahminlerin adları (sunucuda AniList'ten çözülür) */
  titles: Record<number, string>;
  nextAt: number;
}

type Search = { status: 'idle' | 'loading' | 'error' } | { status: 'done'; items: MediaSummary[] };

function useCountdown(target: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (now === null) return '--:--:--';
  const left = Math.max(0, target - now);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function GameBoard({ state: initial, signedIn, loginHref, content: g, formats, genres, titles: initialTitles, nextAt }: GameBoardProps) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [titles, setTitles] = useState(initialTitles);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<Search>({ status: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const countdown = useCountdown(nextAt);
  const listId = useId();

  const guessedIds = useMemo(() => new Set(state.guesses.map((x) => x.id)), [state.guesses]);
  const left = MAX_GUESSES - state.guesses.length;
  const trimmed = query.trim();

  // Yazdıkça ara (yalnızca anime; zaten tahmin edilenler listede çıkmaz).
  useEffect(() => {
    if (trimmed.length < 2) {
      setSearch({ status: 'idle' });
      return;
    }
    setSearch({ status: 'loading' });
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { items: MediaSummary[] };
        setSearch({ status: 'done', items: data.items.filter((m) => m.kind === 'anime') });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setSearch({ status: 'error' });
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const submit = (media: MediaSummary) => {
    setError(null);
    startTransition(async () => {
      const result = await guessAction(media.id);
      if (!result.ok) {
        setError(g.errors[result.error] ?? g.errors.unavailable);
        if (result.error === 'conflict' || result.error === 'finished') router.refresh();
        return;
      }
      setTitles((t) => ({ ...t, [media.id]: media.title }));
      setState(result.state);
      setQuery('');
      setSearch({ status: 'idle' });
      if (result.state.finished) router.refresh(); // sıralama yenilensin
    });
  };

  const clueValue = (key: ClueKey) => {
    const c = state.clues;
    switch (key) {
      case 'basics': {
        const b = c.basics!;
        return fmt(g.basicsValue, {
          format: b.format ? formats[b.format] ?? b.format : g.unknown,
          year: b.year ?? g.unknown,
          episodes: b.episodes ? fmt(g.episodes, { n: b.episodes }) : g.unknown,
        });
      }
      case 'genres':
        return c.genres!.map((x) => genres[x] ?? x).join(', ') || g.unknown;
      case 'studio':
        return c.studio ?? g.unknown;
      case 'tags':
        return c.tags!.join(', ') || g.unknown;
      case 'character':
        return c.character ?? g.unknown;
      default:
        return null;
    }
  };

  const onShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText(g.shareLabel, state.day, state.guesses.length, state.solved));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano izni yok */
    }
  };

  return (
    <div className="space-y-8">
      {/* İpuçları */}
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CLUE_ORDER.map((key, index) => {
          const open = state.revealed.includes(key);
          return (
            <li
              key={key}
              className={cn('rounded-xl border p-4 transition', open ? 'anim-fade border-primary/40 bg-surface shadow-cel-sm' : 'border-dashed border-line bg-fg/[0.03] text-muted')}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                {fmt(g.clue, { n: index + 1 })} · {g.clues[key]}
              </p>
              {!open ? (
                <p className="mt-2 text-sm">🔒 {g.locked}</p>
              ) : key === 'cover' ? (
                <div className="relative mx-auto mt-3 aspect-[2/3] w-28 overflow-hidden rounded-lg bg-night">
                  {state.clues.cover && (
                    <Image
                      src={state.clues.cover}
                      alt=""
                      fill
                      sizes="112px"
                      className={cn('object-cover transition duration-700', state.finished ? '' : 'scale-125 blur-xl')}
                    />
                  )}
                </div>
              ) : (
                <p className="mt-2 text-lg font-bold">{clueValue(key)}</p>
              )}
            </li>
          );
        })}
      </ol>

      {/* Tahminler */}
      {state.guesses.length > 0 && (
        <section aria-labelledby="guesses-title">
          <h2 id="guesses-title" className="mb-2 font-display text-lg">
            {g.guessesTitle}
          </h2>
          <ol className="flex flex-wrap gap-2">
            {state.guesses.map((guess, i) => (
              <li
                key={guess.id}
                className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold', guess.correct ? 'bg-emerald-600 text-white' : 'bg-fg/10')}
              >
                <span className="sr-only">{guess.correct ? g.correct : g.wrong}: </span>
                {i + 1}. {titles[guess.id] ?? `#${guess.id}`} {guess.correct ? '✓' : '✗'}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Tahmin kutusu / oyun sonu */}
      {!state.finished ? (
        signedIn ? (
          <div className="relative max-w-xl">
            <label htmlFor="guess" className="mb-1 block font-semibold">
              {g.guessLabel} <span className="font-normal text-muted">· {fmt(g.attemptsLeft, { n: left })}</span>
            </label>
            <input
              id="guess"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={g.guessPlaceholder}
              autoComplete="off"
              disabled={pending}
              role="combobox"
              aria-expanded={search.status === 'done'}
              aria-controls={listId}
              aria-describedby="guess-hint"
              className="field w-full"
            />
            <p id="guess-hint" className="mt-1 text-sm text-muted">
              {g.guessHint}
            </p>
            <div id={listId} role="listbox" aria-label={g.guessLabel} className={cn(search.status === 'idle' && 'hidden', 'mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-cel')}>
              {search.status === 'loading' && <p className="p-3 text-sm text-muted">{g.searching}</p>}
              {search.status === 'error' && <p className="p-3 text-sm text-primary-text">{g.searchError}</p>}
              {search.status === 'done' &&
                (search.items.filter((m) => !guessedIds.has(m.id)).length === 0 ? (
                  <p className="p-3 text-sm text-muted">{g.noResults}</p>
                ) : (
                  search.items
                    .filter((m) => !guessedIds.has(m.id))
                    .map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => submit(m)}
                        disabled={pending}
                        className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left last:border-0 hover:bg-fg/5 focus-visible:bg-fg/10 disabled:opacity-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{m.title}</span>
                          {m.titleNative && <span className="block truncate text-xs text-muted">{m.titleNative}</span>}
                        </span>
                        {m.year && <span className="text-xs text-muted">{m.year}</span>}
                      </button>
                    ))
                ))}
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm font-semibold text-primary-text">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-5">
            <Button href={loginHref}>{g.signIn}</Button>
            <p className="mt-2 text-sm text-muted">{g.signInHint}</p>
          </div>
        )
      ) : (
        <section aria-live="polite" className="anim-fade rounded-2xl border border-line bg-surface p-5 shadow-cel-sm sm:p-6">
          <p className="font-display text-2xl">{state.solved ? `🎉 ${fmt(g.win, { n: state.guesses.length })}` : `😔 ${g.lose}`}</p>
          {state.answer && (
            <div className="mt-4 flex items-center gap-4">
              <span className="relative block aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg bg-night">
                {state.answer.cover && <Image src={state.answer.cover} alt="" fill sizes="64px" className="object-cover" />}
              </span>
              <div className="min-w-0">
                <p className="text-xl font-bold">{state.answer.title}</p>
                {state.answer.titleNative && <p className="text-sm text-muted">{state.answer.titleNative}</p>}
                <Link href={`/anime/${state.answer.id}`} className="mt-1 inline-block text-sm font-semibold text-primary-text hover:underline">
                  {g.openAnswer} →
                </Link>
              </div>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm font-bold">
            {state.solved && <span className="rounded-md bg-primary px-2.5 py-1 text-white">{fmt(g.points, { n: state.score })}</span>}
            {state.streak > 0 && (
              <span className="rounded-md bg-volt px-2.5 py-1 text-ink" title={g.streakHint}>
                🔥 {fmt(g.streak, { n: state.streak })}
              </span>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Button variant="secondary" onClick={onShare}>
              {copied ? g.copied : g.share}
            </Button>
            <span className="text-sm font-semibold tabular-nums text-muted">{fmt(g.next, { time: countdown })}</span>
          </div>
        </section>
      )}
    </div>
  );
}
