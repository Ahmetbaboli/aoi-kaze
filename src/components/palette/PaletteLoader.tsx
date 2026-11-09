'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Content } from '@/content';
import type { Theme } from '@/lib/theme';

// Palet kodu yalnızca ilk kullanımda indirilir (Lighthouse'u etkilemez).
const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false });

export const PALETTE_OPEN_EVENT = 'palette:open';

interface PaletteLoaderProps {
  content: Content['palette'];
  nav: Content['nav'];
  kinds: Record<string, string>;
  themes: Record<Theme, string>;
}

/** Ctrl/⌘+K ve "palette:open" olayını dinler; açılana kadar hiçbir şey yüklemez. */
export default function PaletteLoader(props: PaletteLoaderProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setMounted(true);
        setOpen((value) => !value);
      }
    };
    const onOpen = () => {
      setMounted(true);
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(PALETTE_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(PALETTE_OPEN_EVENT, onOpen);
    };
  }, []);

  return mounted ? <CommandPalette open={open} onClose={close} {...props} /> : null;
}
