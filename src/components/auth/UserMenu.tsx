'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import type { Content } from '@/content';
import { localePath, splitLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import Link from '@/components/ui/LocLink';
import { useLocale } from '@/components/ui/LocaleProvider';

interface UserMenuProps {
  labels: Content['auth']['menu'];
  /** Dropdown'un hizalanacağı taraf (mobil menüde "left"). */
  align?: 'left' | 'right';
  /** Davet linki (https); tanımsızsa Discord satırı hiç gösterilmez. */
  discordInvite?: string;
  /** Menü bir öğeye gidince çağrılır (mobil menüyü kapatmak için). */
  onNavigate?: () => void;
}

/** E-posta ile girenlerin görseli yoktur: ad ya da e-postanın baş harfiyle avatar çizilir. */
const initialOf = (name?: string | null, email?: string | null) => (name || email || '?').trim().slice(0, 1).toUpperCase();

export default function UserMenu({ labels, align = 'right', discordInvite, onNavigate }: UserMenuProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }, []);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  // Açılınca ilk etkin öğeye odaklan
  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
  }, [open]);

  const items = () => Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'ArrowDown':
        event.preventDefault();
        list[(index + 1) % list.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        list[(index - 1 + list.length) % list.length]?.focus();
        break;
      case 'Home':
        event.preventDefault();
        list[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        list[list.length - 1]?.focus();
        break;
      case 'Tab':
        setOpen(false); // Tab menüden çıkar; odak doğal sıraya devam eder
        break;
    }
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' && !open) {
      event.preventDefault();
      setOpen(true);
    }
  };

  // Yer tutucu: oturum sorgulanırken düğme zıplamasın
  if (status === 'loading') {
    return <span role="status" aria-label={labels.loading} className="inline-block h-10 w-10 animate-pulse rounded-full bg-fg/10" />;
  }

  if (!session?.user) {
    const here = splitLocale(pathname).path;
    const callback = encodeURIComponent(localePath(locale, here));
    return (
      <Link
        href={`/giris?callbackUrl=${callback}`}
        onClick={onNavigate}
        className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90 active:scale-95"
      >
        {labels.login}
      </Link>
    );
  }

  const user = session.user;
  const isAdmin = user.role === 'ADMIN';
  const display = user.name || user.username || user.email || '';

  const itemClass = 'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:bg-fg/10 hover:bg-fg/5';
  const disabledClass = 'flex w-full cursor-not-allowed items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-muted';

  return (
    <div ref={root} className="relative" onKeyDown={onMenuKeyDown}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${labels.account}: ${display}`}
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-line bg-primary text-sm font-bold text-white transition hover:ring-2 hover:ring-primary/50"
      >
        {user.image ? (
          <Image src={user.image} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true">{initialOf(user.name, user.email)}</span>
        )}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={labels.account}
          className={cn(
            'anim-fade absolute top-full z-50 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 text-fg shadow-cel-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="border-b border-line px-3 pb-2 pt-1.5">
            <p className="truncate text-sm font-bold">{display}</p>
            {user.username && <p className="truncate text-xs text-muted">@{user.username}</p>}
          </div>

          <div className="py-1.5">
            {user.username ? (
              <Link
                role="menuitem"
                href={`/u/${user.username}`}
                onClick={() => {
                  close();
                  onNavigate?.();
                }}
                className={itemClass}
              >
                {labels.profile}
              </Link>
            ) : (
              <span role="menuitem" aria-disabled="true" tabIndex={-1} className={disabledClass}>
                {labels.profile}
              </span>
            )}
            <Link
              role="menuitem"
              href="/listem"
              onClick={() => {
                close();
                onNavigate?.();
              }}
              className={itemClass}
            >
              {labels.list}
            </Link>
            <Link
              role="menuitem"
              href="/hesap"
              onClick={() => {
                close();
                onNavigate?.();
              }}
              className={itemClass}
            >
              {labels.settings}
            </Link>
            {isAdmin && (
              <Link
                role="menuitem"
                href="/admin"
                onClick={() => {
                  close();
                  onNavigate?.();
                }}
                className={itemClass}
              >
                {labels.admin}
              </Link>
            )}
            {discordInvite && (
              <a role="menuitem" href={discordInvite} target="_blank" rel="noopener noreferrer" className={itemClass} onClick={() => close()}>
                {labels.discord} <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>

          <div className="border-t border-line pt-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut({ redirectTo: localePath(locale, '/') })}
              className={cn(itemClass, 'text-primary-text')}
            >
              {labels.logout}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
