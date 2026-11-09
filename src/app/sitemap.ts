import type { MetadataRoute } from 'next';
import { getContent } from '@/content';
import { getAllPosts } from '@/lib/blog';
import { defaultLocale, localePath, locales } from '@/lib/i18n';
import { siteUrl } from '@/lib/seo';

const absolute = (locale: (typeof locales)[number], path: string) => `${siteUrl}${localePath(locale, path)}`;

/** Her sayfa için tüm dillerin karşılıklarını (hreflang) içeren site haritası. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pagePaths = getContent(defaultLocale).nav.map((item) => item.href);

  const pages = pagePaths.flatMap((path) =>
    locales.map((locale) => ({
      url: absolute(locale, path),
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, absolute(l, path)])) },
    })),
  );

  const posts = locales.flatMap((locale) =>
    getAllPosts(locale).map((post) => ({
      url: absolute(locale, `/blog/${post.slug}`),
      lastModified: post.date,
      alternates: {
        languages: Object.fromEntries(
          locales.filter((l) => getAllPosts(l).some((p) => p.slug === post.slug)).map((l) => [l, absolute(l, `/blog/${post.slug}`)]),
        ),
      },
    })),
  );

  return [...pages, ...posts];
}
