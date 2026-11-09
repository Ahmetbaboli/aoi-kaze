import Script from 'next/script';

/**
 * Umami (çerezsiz, gizlilik dostu analitik). Kendi sunucundaki Umami'yi kullanmak için
 * NEXT_PUBLIC_UMAMI_SCRIPT_URL ve NEXT_PUBLIC_UMAMI_WEBSITE_ID tanımla.
 * İkisi de yoksa hiçbir şey yüklenmez. "Do Not Track" ayarına saygı gösterilir.
 */
export default function Analytics() {
  const src = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (!src || !websiteId) return null;

  return <Script src={src} data-website-id={websiteId} data-do-not-track="true" strategy="lazyOnload" />;
}
