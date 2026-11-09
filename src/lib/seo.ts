import type { Metadata } from 'next';
import { getContent } from '@/content';
import { defaultLocale, localePath, locales, type Locale } from '@/lib/i18n';

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

type PageKey = keyof ReturnType<typeof getContent>['seo']['pages'];

/** canonical + hreflang (tüm diller + x-default). Yollar dil önekli yazılır, metadataBase ile tamamlanır. */
export function alternatesFor(path: string, locale: Locale) {
  return {
    canonical: localePath(locale, path),
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, localePath(l, path)])),
      'x-default': localePath(defaultLocale, path),
    },
  };
}

/** Sayfa bazlı meta + Open Graph. Metinler content/<dil>.ts içinden gelir. */
export function pageMetadata(key: PageKey, path: string, locale: Locale): Metadata {
  const c = getContent(locale);
  const page = c.seo.pages[key];
  return {
    title: page.title,
    description: page.description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      title: `${page.title} | ${c.site.name}`,
      description: page.description,
      url: localePath(locale, path),
      siteName: c.site.name,
      type: 'website',
      locale: c.ogLocale,
    },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description },
  };
}
