'use client';

import { useEffect, useRef } from 'react';
import Link from '@/components/ui/LocLink';
import { AnimatePresence, m } from 'framer-motion';
import type { Content } from '@/content';
import type { NavItem } from '@/content/types';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme';
import LocaleSwitch from './LocaleSwitch';
import ThemeMenu from './ThemeMenu';
import UserMenu from '@/components/auth/UserMenu';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  isActive: (href: string) => boolean;
  labels: {
    menu: string;
    close: string;
    themeMenu: string;
    themes: Record<Theme, string>;
    language: string;
  };
  userMenu: Content['auth']['menu'];
  discordInvite?: string;
}

/** Sağdan kayan yan panel. Esc ile kapanır, odak panel içinde tutulur. */
export default function MobileMenu({ open, onClose, items, isActive, labels, userMenu, discordInvite }: MobileMenuProps) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('a, button');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-night/70 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <m.aside
            key="panel"
            id="mobile-menu"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={labels.menu}
            className="fixed right-0 top-0 z-50 flex h-full w-[82%] max-w-sm flex-col gap-2 border-l border-line bg-bg p-6 shadow-cel lg:hidden"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.35 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ThemeMenu label={labels.themeMenu} themes={labels.themes} align="left" />
                <LocaleSwitch label={labels.language} />
                <UserMenu labels={userMenu} align="left" discordInvite={discordInvite} onNavigate={onClose} />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={labels.close}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 5l14 14M19 5L5 19" />
                </svg>
              </button>
            </div>
            <nav aria-label={labels.menu}>
              <ul className="flex flex-col gap-3">
                {items.map((item, index) => {
                  const active = isActive(item.href);
                  return (
                    <m.li
                      key={item.href}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                    >
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-baseline justify-between rounded-xl border px-4 py-3 text-lg font-bold',
                          active ? 'border-transparent bg-primary text-white' : 'border-line bg-surface text-fg',
                        )}
                      >
                        {item.label}
                      </Link>
                    </m.li>
                  );
                })}
              </ul>
            </nav>
          </m.aside>
        </>
      )}
    </AnimatePresence>
  );
}
