'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/ui/LocLink';
import { usePathname } from 'next/navigation';
import { m } from 'framer-motion';
import type { Content } from '@/content';
import { localePath, splitLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import Wordmark from '@/components/ui/Wordmark';
import { useLocale } from '@/components/ui/LocaleProvider';
import { PALETTE_OPEN_EVENT } from '@/components/palette/PaletteLoader';
import MobileMenu from './MobileMenu';
import LocaleSwitch from './LocaleSwitch';
import ThemeMenu from './ThemeMenu';
import UserMenu from '@/components/auth/UserMenu';

interface NavbarProps {
  paletteLabel: string;
  paletteShortcut: string;
  siteName: string;
  brandAlt: string;
  nav: Content['nav'];
  a11y: Content['a11y'];
  userMenu: Content['auth']['menu'];
  discordInvite?: string;
}

/** Aktif sayfanın altında kayan ince çizgi. */
function ActiveBar() {
  return (
    <m.span
      layoutId="nav-active"
      aria-hidden="true"
      className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-primary"
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
    />
  );
}

export default function Navbar({ siteName, brandAlt, nav, a11y, paletteLabel, paletteShortcut, userMenu, discordInvite }: NavbarProps) {
  const locale = useLocale();
  const rawPathname = usePathname();
  const pathname = splitLocale(rawPathname).path;
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const isActive = useCallback(
    (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href)),
    [pathname],
  );

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label={brandAlt} className="flex items-center gap-2">
            <Wordmark name={siteName} />
          </Link>

          <nav aria-label={a11y.mainNav} className="hidden items-center gap-1 lg:flex">
            <ul className="flex items-center gap-2">
              {nav.filter((item) => item.primary).map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative block px-3 py-2 text-sm font-semibold transition-colors hover:text-primary-text',
                        active ? 'text-fg' : 'text-fg/75',
                      )}
                    >
                      <span className="relative z-10">{item.label}</span>
                      {active && <ActiveBar />}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <form action={localePath(locale, '/ara')} method="get" role="search" className="ml-2 hidden xl:block">
              <label htmlFor="nav-q" className="sr-only">
                {a11y.search}
              </label>
              <div className="relative">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16 16l5 5" />
                </svg>
                <input id="nav-q" name="q" type="search" minLength={2} maxLength={60} placeholder={a11y.search + '…'} className="h-10 w-44 rounded-lg border border-line bg-surface pl-9 pr-3 text-sm focus:w-56 transition-all" />
              </div>
            </form>
            <Link
              href="/ara"
              aria-label={a11y.search}
              title={a11y.search}
              aria-current={isActive('/ara') ? 'page' : undefined}
              className="ml-2 flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface transition hover:bg-fg/5 xl:hidden"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l5 5" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(PALETTE_OPEN_EVENT))}
              aria-label={paletteLabel}
              title={paletteLabel}
              className="ml-2 hidden h-10 items-center rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-muted transition hover:bg-fg/5 2xl:flex"
            >
              {paletteShortcut}
            </button>
            <div className="ml-3">
              <div className="flex items-center gap-2">
                <LocaleSwitch label={a11y.languageNav} />
                <ThemeMenu label={a11y.themeMenu} themes={a11y.themes} />
                <UserMenu labels={userMenu} discordInvite={discordInvite} />
              </div>
            </div>
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={a11y.openMenu}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface lg:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        items={nav}
        isActive={isActive}
        labels={{
          menu: a11y.menuLabel,
          close: a11y.closeMenu,
          themeMenu: a11y.themeMenu,
          themes: a11y.themes,
          language: a11y.languageNav,
        }}
        userMenu={userMenu}
        discordInvite={discordInvite}
      />
    </>
  );
}
