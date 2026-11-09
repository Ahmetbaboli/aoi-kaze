'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, m } from 'framer-motion';
import type { Content } from '@/content';
import type { MediaSummary } from '@/lib/catalog/types';
import type { SearchIndexEntry } from '@/lib/blog';
import { localePath } from '@/lib/i18n';
import { fmt } from '@/lib/utils';
import { useLocale } from '@/components/ui/LocaleProvider';
import { fold, score } from '@/lib/text';
import { THEMES, setTheme, toggleTheme, type Theme } from '@/lib/theme';

type Group = 'pages' | 'actions' | 'catalog' | 'blog';

interface Item {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  content: Content['palette'];
  nav: Content['nav'];
  kinds: Record<string, string>;
  themes: Record<Theme, string>;
}

const GROUP_ORDER: Group[] = ['pages', 'actions', 'catalog', 'blog'];
const MAX_PER_GROUP = 8;
const DEBOUNCE_MS = 300;

/** Anime "komut menüsü" tarzı arama paleti. Combobox/listbox ARIA düzeniyle klavyeden tam kullanılır. */
export default function CommandPalette({ open, onClose, content, nav, kinds, themes }: CommandPaletteProps) {
  const router = useRouter();
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [blog, setBlog] = useState<SearchIndexEntry[]>([]);
  const [catalog, setCatalog] = useState<MediaSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(localePath(locale, href));
    },
    [onClose, router, locale],
  );

  // Açılışta sıfırla, odakla, kaydırmayı kilitle, blog dizinini bir kez çek.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();

    if (blog.length === 0) {
      fetch(`/${locale}/search-index.json`)
        .then((response) => (response.ok ? response.json() : []))
        .then((data: SearchIndexEntry[]) => setBlog(data))
        .catch(() => undefined);
    }

    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
    // blog.length bilerek bağımlılık dışında: yalnızca açılışta bir kez denenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Katalog araması (debounce'lu, iptal edilebilir).
  const trimmed = query.trim();
  useEffect(() => {
    if (!open || trimmed.length < 2) {
      setCatalog([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const data = response.ok ? ((await response.json()) as { items: MediaSummary[] }) : { items: [] };
        setCatalog(data.items);
        setLoading(false);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, open]);

  const items = useMemo<Item[]>(() => {
    const pages: Item[] = nav.map((entry) => ({
      id: `page:${entry.href}`,
      group: 'pages',
      label: entry.label,
      
      run: () => go(entry.href),
    }));
    const actions: Item[] = [
      { id: 'act:theme', group: 'actions', label: content.actions.toggleTheme, run: () => { toggleTheme(); onClose(); } },
      ...THEMES.map((id) => ({
        id: `act:theme:${id}`,
        group: 'actions' as const,
        label: fmt(content.actions.theme, { name: themes[id] }),
        run: () => {
          setTheme(id);
          onClose();
        },
      })),
      { id: 'act:list', group: 'actions', label: content.actions.openList, run: () => go('/listem') },
      { id: 'act:search', group: 'actions', label: content.actions.openSearch, run: () => go(trimmed ? `/ara?q=${encodeURIComponent(trimmed)}` : '/ara') },
    ];

    const matchSimple = (list: Item[]) =>
      trimmed ? list.filter((item) => score(trimmed, [{ text: item.label, weight: 3 }, { text: item.hint ?? '', weight: 1 }]) > 0) : list;

    const blogItems: Item[] = trimmed
      ? blog
          .map((post) => ({
            post,
            value: score(trimmed, [
              { text: post.title, weight: 4 },
              { text: post.tags.join(' '), weight: 3 },
              { text: post.description, weight: 2 },
              { text: post.text, weight: 1 },
            ]),
          }))
          .filter((entry) => entry.value > 0)
          .sort((a, b) => b.value - a.value)
          .map(({ post }) => ({
            id: `blog:${post.slug}`,
            group: 'blog' as const,
            label: post.title,
            run: () => go(`/blog/${post.slug}`),
          }))
      : [];

    const catalogItems: Item[] = catalog.map((media) => ({
      id: `media:${media.id}`,
      group: 'catalog' as const,
      label: media.title,
      hint: kinds[media.kind],
      run: () => go(`/${media.kind}/${media.id}`),
    }));

    const all = [...matchSimple(pages), ...matchSimple(actions), ...catalogItems, ...blogItems];
    return GROUP_ORDER.flatMap((group) => all.filter((item) => item.group === group).slice(0, MAX_PER_GROUP));
  }, [nav, content, blog, catalog, trimmed, go, onClose, kinds, themes]);

  useEffect(() => setActive(0), [trimmed]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      items[active]?.run();
    } else if (event.key === 'Tab') {
      event.preventDefault(); // odak giriş alanında kalır, gezinme ok tuşlarıyla
    }
  };

  useEffect(() => {
    document.getElementById(`palette-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const status = loading ? content.loading : trimmed && items.length === 0 ? fmt(content.empty, { q: trimmed }) : fmt(content.results, { n: items.length });

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]" onKeyDown={onKeyDown}>
          <m.div
            aria-hidden="true"
            className="absolute inset-0 bg-night/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <m.div
            role="dialog"
            aria-modal="true"
            aria-label={content.label}
            className="relative w-full max-w-xl rounded-lg border border-line bg-surface text-fg shadow-cel"
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          >
            <p aria-hidden="true" className="absolute -top-4 left-4  rounded-lg border border-line bg-primary px-3 font-display text-lg text-white">
              {content.title}
            </p>
            <div className="border-b border-line p-4 pt-6">
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={items.length ? `palette-opt-${active}` : undefined}
                aria-autocomplete="list"
                aria-label={content.label}
                placeholder={content.placeholder}
                autoComplete="off"
                spellCheck={false}
                maxLength={60}
                className="field !py-3 text-lg"
              />
            </div>

            <div id="palette-list" role="listbox" aria-label={content.label} className="max-h-[50vh] overflow-y-auto p-2">
              {GROUP_ORDER.map((group) => {
                const groupItems = items.filter((item) => item.group === group);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group} role="group" aria-label={content.groups[group]} className="mb-2">
                    <p aria-hidden="true" className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-widest text-muted">
                      {content.groups[group]}
                    </p>
                    {groupItems.map((item) => {
                      const index = items.indexOf(item);
                      const selected = index === active;
                      return (
                        <div
                          key={item.id}
                          id={`palette-opt-${index}`}
                          role="option"
                          aria-selected={selected}
                          onMouseMove={() => setActive(index)}
                          onClick={item.run}
                          className={`flex cursor-pointer items-center justify-between gap-3 border px-3 py-2 font-bold ${selected ? 'border-line bg-primary text-white' : 'border-transparent'}`}
                        >
                          <span className="line-clamp-1">{item.label}</span>
                          {item.hint && <span className={`shrink-0 text-xs ${selected ? 'text-white/90' : 'text-muted'}`}>{item.hint}</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {trimmed && items.length === 0 && !loading && <p className="p-4 text-muted">{fmt(content.empty, { q: trimmed })}</p>}
            </div>

            <p role="status" aria-live="polite" className="sr-only">
              {status}
            </p>
            <p aria-hidden="true" className="border-t border-line px-4 py-2 text-xs font-bold text-muted">
              {content.hint}
            </p>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
