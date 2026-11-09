'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from '@/components/ui/LocaleProvider';
import type { Theme, ThemeChangeDetail } from '@/lib/theme';
import { getTheme } from '@/lib/theme';

/**
 * Giscus (GitHub Discussions) yorumları. Ayarlar .env'den okunur (NEXT_PUBLIC_GISCUS_*);
 * eksikse bileşen hiçbir şey göstermez. Kaydırıp yaklaşınca yüklenir ve site temasını izler.
 */
const config = {
  repo: process.env.NEXT_PUBLIC_GISCUS_REPO,
  repoId: process.env.NEXT_PUBLIC_GISCUS_REPO_ID,
  category: process.env.NEXT_PUBLIC_GISCUS_CATEGORY,
  categoryId: process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID,
};

const giscusTheme = (theme: Theme) => (theme === 'light' ? 'light' : 'dark');

export default function Comments({ title }: { title: string }) {
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const enabled = !!(config.repo && config.repoId && config.category && config.categoryId);

  useEffect(() => {
    const host = container.current;
    if (!enabled || !host) return;

    const load = () => {
      const script = document.createElement('script');
      script.src = 'https://giscus.app/client.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      Object.entries({
        'data-repo': config.repo,
        'data-repo-id': config.repoId,
        'data-category': config.category,
        'data-category-id': config.categoryId,
        'data-mapping': 'pathname',
        'data-strict': '0',
        'data-reactions-enabled': '1',
        'data-emit-metadata': '0',
        'data-input-position': 'top',
        'data-theme': giscusTheme(getTheme()),
        'data-lang': locale,
        'data-loading': 'lazy',
      }).forEach(([key, value]) => script.setAttribute(key, value ?? ''));
      host.appendChild(script);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(host);

    const onTheme = (event: Event) => {
      const { theme } = (event as CustomEvent<ThemeChangeDetail>).detail;
      host.querySelector<HTMLIFrameElement>('iframe.giscus-frame')?.contentWindow?.postMessage(
        { giscus: { setConfig: { theme: giscusTheme(theme) } } },
        'https://giscus.app',
      );
    };
    window.addEventListener('themechange', onTheme);

    return () => {
      observer.disconnect();
      window.removeEventListener('themechange', onTheme);
    };
  }, [enabled, locale]);

  if (!enabled) return null;

  return (
    <section aria-labelledby="comments-title" className="mt-16">
      <h2 id="comments-title" className="mb-4 font-display text-2xl">
        {title}
      </h2>
      <div ref={container} className="giscus" />
    </section>
  );
}
