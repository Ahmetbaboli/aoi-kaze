import { getContent } from '@/content';
import { getAllPosts } from '@/lib/blog';
import { isLocale, localePath, locales, type Locale } from '@/lib/i18n';
import { siteUrl } from '@/lib/seo';

// Build sırasında her dil için üretilir.
export const dynamic = 'force-static';
export const generateStaticParams = () => locales.map((locale) => ({ locale }));

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** /tr/rss.xml ve /en/rss.xml: blog için RSS 2.0 beslemesi. */
export function GET(_request: Request, { params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return new Response('Not found', { status: 404 });
  const locale: Locale = params.locale;
  const c = getContent(locale);

  const items = getAllPosts(locale)
    .map((post) => {
      const link = `${siteUrl}${localePath(locale, `/blog/${post.slug}`)}`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.description)}</description>
${post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`).join('\n')}
    </item>`;
    })
    .join('\n');

  const feedUrl = `${siteUrl}/${locale}/rss.xml`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(c.seo.rssTitle)}</title>
    <link>${siteUrl}${localePath(locale, '/blog')}</link>
    <description>${escapeXml(c.seo.rssDescription)}</description>
    <language>${locale}</language>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
