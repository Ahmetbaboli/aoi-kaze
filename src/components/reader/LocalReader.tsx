'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { fmt } from '@/lib/utils';
import type { Content } from '@/content';
import Button from '@/components/ui/Button';

type Mode = 'page' | 'scroll';

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;
const MAX_PAGES = 1500;

/** "2.jpg" < "10.jpg" olacak şekilde doğal sıralama. */
const naturalSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

interface Book {
  name: string;
  pages: { name: string; url: string }[];
}

/**
 * Yerel okuyucu: kullanıcının kendi cihazındaki CBZ/ZIP arşivini ya da görsel dosyalarını okur.
 * Dosyalar tarayıcıdan dışarı çıkmaz (sunucuya yüklenmez); bu sitede hiçbir manga barındırılmaz.
 */
export default function LocalReader({ content }: { content: Content['reader'] }) {
  const [book, setBook] = useState<Book | null>(null);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('page');
  const [rtl, setRtl] = useState(true);
  const [fitWidth, setFitWidth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const urls = useRef<string[]>([]);

  const releaseUrls = useCallback(() => {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current = [];
  }, []);
  useEffect(() => releaseUrls, [releaseUrls]);

  const open = useCallback(
    async (files: File[]) => {
      setError(null);
      if (files.length === 0) return;
      setBusy(true);
      try {
        const entries: { name: string; blob: Blob }[] = [];
        const archive = files.find((f) => /\.(cbz|zip)$/i.test(f.name));
        if (archive) {
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(archive);
          const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir && IMAGE_EXT.test(n) && !n.includes('__MACOSX')).sort(naturalSort);
          if (names.length > MAX_PAGES) throw new Error('too-many');
          for (const name of names) entries.push({ name, blob: await zip.files[name].async('blob') });
        } else {
          files
            .filter((f) => IMAGE_EXT.test(f.name) || f.type.startsWith('image/'))
            .sort((a, b) => naturalSort(a.name, b.name))
            .slice(0, MAX_PAGES)
            .forEach((f) => entries.push({ name: f.name, blob: f }));
        }
        if (entries.length === 0) throw new Error('empty');

        releaseUrls();
        const pages = entries.map((e) => {
          const url = URL.createObjectURL(e.blob);
          urls.current.push(url);
          return { name: e.name, url };
        });
        setBook({ name: (archive ?? files[0]).name.replace(/\.[^.]+$/, ''), pages });
        setIndex(0);
      } catch (err) {
        setError((err as Error).message === 'too-many' ? content.errorTooMany : content.errorEmpty);
      } finally {
        setBusy(false);
      }
    },
    [content.errorEmpty, content.errorTooMany, releaseUrls],
  );

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    void open(Array.from(event.target.files ?? []));
    event.target.value = '';
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void open(Array.from(event.dataTransfer.files));
  };

  const total = book?.pages.length ?? 0;
  const go = useCallback((delta: number) => setIndex((i) => Math.min(Math.max(i + delta, 0), Math.max(total - 1, 0))), [total]);

  useEffect(() => {
    if (!book || mode !== 'page') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;
      const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
      const back = rtl ? 'ArrowRight' : 'ArrowLeft';
      if (event.key === forward || event.key === ' ') {
        event.preventDefault();
        go(1);
      } else if (event.key === back) {
        event.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [book, mode, rtl, go]);

  // Sayfa görünür kalsın: yeni sayfada ve mod değişiminde okuyucunun başına kaydır.
  useEffect(() => {
    if (book && mode === 'page') stage.current?.scrollIntoView({ block: 'nearest' });
  }, [index, book, mode]);

  const preload = useMemo(() => (book && mode === 'page' ? [book.pages[index + 1], book.pages[index - 1]].filter(Boolean) : []), [book, index, mode]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen?.();
  };

  if (!book) {
    return (
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-10 text-center transition ${dragging ? 'border-primary bg-primary/10' : 'border-line bg-surface'}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-primary-text">
          <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z" />
          <path d="M8 7h6M8 11h6" />
        </svg>
        <h2 className="font-display text-2xl">{content.dropTitle}</h2>
        <p className="max-w-lg text-muted">{content.dropText}</p>
        <label className="cursor-pointer">
          <span className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-within:outline">
            {busy ? content.loading : content.choose}
          </span>
          <input type="file" accept=".cbz,.zip,image/*" multiple onChange={onPick} className="sr-only" disabled={busy} />
        </label>
        <p className="text-xs text-muted">{content.privacy}</p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-primary-text">
            {error}
          </p>
        )}
      </div>
    );
  }

  const current = book.pages[index];

  return (
    <div ref={stage} className="rounded-2xl border border-line bg-night text-[#F1F3FA]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-3 text-sm">
        <p className="min-w-0 truncate font-semibold">{book.name}</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={content.mode}
            value={mode}
            onChange={(event) => setMode(event.target.value as Mode)}
            className="rounded-lg border border-white/20 bg-black/30 px-2 py-1.5"
          >
            <option value="page">{content.modePage}</option>
            <option value="scroll">{content.modeScroll}</option>
          </select>
          {mode === 'page' && (
            <button type="button" aria-pressed={rtl} onClick={() => setRtl((v) => !v)} className="rounded-lg border border-white/20 px-3 py-1.5 aria-pressed:bg-primary">
              {content.rtl}
            </button>
          )}
          <button type="button" aria-pressed={fitWidth} onClick={() => setFitWidth((v) => !v)} className="rounded-lg border border-white/20 px-3 py-1.5 aria-pressed:bg-primary">
            {content.fitWidth}
          </button>
          <button type="button" onClick={toggleFullscreen} className="rounded-lg border border-white/20 px-3 py-1.5">
            {content.fullscreen}
          </button>
          <button
            type="button"
            onClick={() => {
              releaseUrls();
              setBook(null);
            }}
            className="rounded-lg border border-white/20 px-3 py-1.5"
          >
            {content.close}
          </button>
        </div>
      </div>

      {mode === 'page' ? (
        <>
          <div className="relative flex max-h-[80vh] min-h-[50vh] items-center justify-center overflow-auto bg-black/40 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.url}
              src={current.url}
              alt={fmt(content.pageAlt, { n: index + 1, total })}
              className={`anim-fade mx-auto ${fitWidth ? 'w-full max-w-4xl' : 'max-h-[78vh] w-auto max-w-full'} object-contain`}
            />
            <button
              type="button"
              aria-label={rtl ? content.next : content.prev}
              onClick={() => go(rtl ? 1 : -1)}
              className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize opacity-0 focus-visible:opacity-100 focus-visible:bg-white/10"
            />
            <button
              type="button"
              aria-label={rtl ? content.prev : content.next}
              onClick={() => go(rtl ? -1 : 1)}
              className="absolute inset-y-0 right-0 w-1/4 cursor-e-resize opacity-0 focus-visible:opacity-100 focus-visible:bg-white/10"
            />
          </div>
          <div className="flex items-center gap-3 border-t border-white/10 p-3 text-sm">
            <Button variant="secondary" onClick={() => go(-1)} disabled={index === 0} className="!px-3 !py-1.5 !text-[#F1F3FA]">
              {content.prev}
            </Button>
            <input
              type="range"
              min={1}
              max={total}
              value={index + 1}
              onChange={(event) => setIndex(Number(event.target.value) - 1)}
              aria-label={content.goToPage}
              className="min-w-0 flex-1 accent-[rgb(225,29,72)]"
              dir={rtl ? 'rtl' : 'ltr'}
            />
            <span role="status" aria-live="polite" className="shrink-0 tabular-nums">
              {fmt(content.pageOf, { n: index + 1, total })}
            </span>
            <Button variant="secondary" onClick={() => go(1)} disabled={index === total - 1} className="!px-3 !py-1.5 !text-[#F1F3FA]">
              {content.next}
            </Button>
          </div>
          <div aria-hidden="true" className="hidden">
            {preload.map((page) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={page.url} src={page.url} alt="" />
            ))}
          </div>
        </>
      ) : (
        <div className="max-h-[85vh] overflow-y-auto bg-black/40">
          <ol className={`mx-auto flex flex-col ${fitWidth ? 'max-w-4xl' : 'max-w-2xl'}`}>
            {book.pages.map((page, i) => (
              <li key={page.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.url} alt={fmt(content.pageAlt, { n: i + 1, total })} loading="lazy" className="block w-full" />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
