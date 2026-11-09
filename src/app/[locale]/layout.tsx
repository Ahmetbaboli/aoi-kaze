import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { getContent } from '@/content';
import { fontVariables } from '@/fonts';
import { isLocale, locales, localePath, defaultLocale, type Locale } from '@/lib/i18n';
import { siteUrl } from '@/lib/seo';
import { LocaleProvider } from '@/components/ui/LocaleProvider';
import Providers from '@/components/ui/Providers';
import Navbar from '@/components/layout/Navbar';
import Analytics from '@/components/layout/Analytics';
import Footer from '@/components/layout/Footer';
import PaletteLoader from '@/components/palette/PaletteLoader';
import PageExtras from '@/components/layout/PageExtras';
import { discordInviteUrl } from '@/lib/discord';
import '../globals.css';

interface LayoutProps {
  children: React.ReactNode;
  params: { locale: Locale };
}

// Yalnızca tanımlı diller geçerli; diğerleri 404.
export const dynamicParams = false;
export const generateStaticParams = () => locales.map((locale) => ({ locale }));

export function generateMetadata({ params }: LayoutProps): Metadata {
  const content = getContent(params.locale);
  return {
    metadataBase: new URL(siteUrl),
    title: { default: content.seo.siteTitle, template: content.seo.titleTemplate },
    description: content.seo.description,
    alternates: {
      canonical: localePath(params.locale, '/'),
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, localePath(l, '/')])),
        'x-default': localePath(defaultLocale, '/'),
      },
      types: { 'application/rss+xml': `/${params.locale}/rss.xml` },
    },
    openGraph: {
      type: 'website',
      siteName: content.site.name,
      title: content.seo.siteTitle,
      description: content.seo.description,
      locale: content.ogLocale,
    },
    twitter: { card: 'summary_large_image' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0A0A10' },
  ],
};

// Boyamadan önce temayı ayarlar (kayıtlı tercih > cihaz tercihi).
const themeScript = `(function(){var d=document.documentElement,t;try{t=localStorage.getItem('theme')}catch(e){}if(['light','dark'].indexOf(t)<0){t='dark'}d.dataset.theme=t})();`;

export default function RootLayout({ children, params }: LayoutProps) {
  if (!isLocale(params.locale)) notFound();
  const content = getContent(params.locale);
  const discordInvite = discordInviteUrl();

  return (
    <html lang={params.locale} className={fontVariables} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <LocaleProvider locale={params.locale}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:border focus:rounded-lg focus:border-line focus:bg-surface focus:px-4 focus:py-2 focus:font-semibold focus:text-fg"
          >
            {content.a11y.skipToContent}
          </a>
          <Providers>
            <Navbar
              siteName={content.site.name}
              brandAlt={content.site.brandAlt}
              nav={content.nav}
              a11y={content.a11y}
              paletteLabel={content.palette.open}
              paletteShortcut={content.palette.shortcut}
              userMenu={content.auth.menu}
              discordInvite={discordInvite}
            />
            <PaletteLoader content={content.palette} nav={content.nav} kinds={content.catalog.kindLabel} themes={content.a11y.themes} />
            <main id="main" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <PageExtras topLabel={content.a11y.backToTop} />
            <Footer content={content.footer} links={content.nav} discordInvite={discordInvite} discordLabel={content.auth.menu.discord} />
          </Providers>
        </LocaleProvider>
        <Analytics />
      </body>
    </html>
  );
}
