export const locales = ['tr', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'tr';

export const isLocale = (value: string | undefined): value is Locale => locales.includes(value as Locale);

export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** "/anime?x=1" -> "/tr/anime?x=1"; "/" -> "/tr"; dış bağlantılara ve zaten dil önekli yollara dokunmaz. */
export function localePath(locale: Locale, href: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const first = href.split(/[/?#]/)[1];
  if (isLocale(first)) return href;
  if (href === '/') return `/${locale}`;
  return `/${locale}${href}`;
}

/** "/en/blog/x" -> { locale: 'en', path: '/blog/x' } */
export function splitLocale(pathname: string): { locale: Locale | null; path: string } {
  const segments = pathname.split('/');
  if (isLocale(segments[1])) {
    return { locale: segments[1], path: `/${segments.slice(2).join('/')}`.replace(/\/$/, '') || '/' };
  }
  return { locale: null, path: pathname };
}

/** Sunucu: dil başlığına bakarak ilk ziyaret için dil seçer. */
export function pickLocale(acceptLanguage: string | null): Locale {
  const wanted = (acceptLanguage ?? '').toLowerCase().split(',').map((part) => part.trim().slice(0, 2));
  return wanted.find((code): code is Locale => isLocale(code)) ?? defaultLocale;
}

/** Sayfa ve layout bileşenlerine gelen dil parametresi */
export interface LocaleParams {
  params: { locale: Locale };
}
