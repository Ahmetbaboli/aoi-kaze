'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALE_COOKIE, locales, splitLocale, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/ui/LocaleProvider';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** "TR | EN" manga etiketi. Seçim çerezde saklanır; aynı sayfanın diğer dildeki karşılığına gider. */
export default function LocaleSwitch({ label }: { label: string }) {
  const current = useLocale();
  const { path } = splitLocale(usePathname());

  const remember = (locale: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
  };

  return (
    <nav aria-label={label} className="flex  rounded-lg border border-line shadow-cel-sm">
      {locales.map((locale, index) => (
        <Link
          key={locale}
          href={`/${locale}${path === '/' ? '' : path}`}
          hrefLang={locale}
          lang={locale}
          onClick={() => remember(locale)}
          aria-current={locale === current ? 'true' : undefined}
          className={cn(
            'flex h-[2.15rem] items-center px-2.5 font-display text-lg',
            index > 0 && 'border-l border-line',
            locale === current ? 'bg-primary text-white' : 'bg-surface text-fg hover:bg-primary hover:text-white',
          )}
        >
          {locale}
        </Link>
      ))}
    </nav>
  );
}
