'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  THEMES,
  THEME_SWATCH,
  getTheme,
  setTheme,
  type Theme,
  type ThemeChangeDetail,
} from '@/lib/theme';

interface ThemeMenuProps {
  label: string;
  themes: Record<Theme, string>;
  align?: 'left' | 'right';
}

/**
 * Tema seçici açılır menü. İlk tema layout'taki satır içi betikle (boyamadan önce) ayarlanır:
 * kayıtlı tercih varsa o, yoksa koyu tema.
 */
export default function ThemeMenu({ label, themes, align = 'right' }: ThemeMenuProps) {
  const [theme, setCurrent] = useState<Theme>('light');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sync = (event?: Event) =>
      setCurrent((event as CustomEvent<ThemeChangeDetail> | undefined)?.detail?.theme ?? getTheme());
    sync();
    window.addEventListener('themechange', sync);

    return () => {
      window.removeEventListener('themechange', sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="theme-menu"
        aria-label={`${label}: ${themes[theme]}`}
        title={label}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface text-fg transition hover:bg-fg/5"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3Z" />
          <circle cx="7.5" cy="11" r="1" fill="currentColor" />
          <circle cx="11" cy="7.5" r="1" fill="currentColor" />
          <circle cx="15.5" cy="8" r="1" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <ul
          id="theme-menu"
          className={cn(
            'absolute top-full z-50 mt-2 w-48 rounded-xl border border-line bg-surface p-1.5 text-fg shadow-cel',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {THEMES.map((id) => (
            <li key={id}>
              <button
                type="button"
                aria-pressed={id === theme}
                onClick={() => {
                  setTheme(id);
                  setOpen(false);
                  button.current?.focus();
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-semibold',
                  id === theme ? 'border-transparent bg-primary text-white' : 'border-transparent hover:border-line',
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 rounded-full border border-line"
                  style={{ background: `linear-gradient(135deg, ${THEME_SWATCH[id][0]} 50%, ${THEME_SWATCH[id][1]} 50%)` }}
                />
                {themes[id]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
