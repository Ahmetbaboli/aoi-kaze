'use client';

import { useEffect, useState } from 'react';
import type { Heading } from '@/lib/blog';
import { cn } from '@/lib/utils';

interface TableOfContentsProps {
  headings: Heading[];
  title: string;
  navLabel: string;
  variant: 'mobile' | 'desktop';
}

/** Masaüstünde yapışkan, mobilde açılır panel. Okunan başlık vurgulanır. */
export default function TableOfContents({ headings, title, navLabel, variant }: TableOfContentsProps) {
  const [active, setActive] = useState<string>(headings[0]?.id ?? '');

  useEffect(() => {
    const elements = headings.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;

    // Ekranın üst bölümüne ulaşan en son başlık "aktif" sayılır.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 3) return null;

  const list = (
    <ol className="space-y-1.5 text-sm">
      {headings.map((heading) => (
        <li key={heading.id} className={heading.level === 3 ? 'pl-4' : ''}>
          <a
            href={`#${heading.id}`}
            aria-current={active === heading.id ? 'location' : undefined}
            className={cn(
              'block border-l-4 py-0.5 pl-3 font-bold transition-colors',
              active === heading.id ? 'border-primary text-primary-text' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === 'mobile') {
    return (
      <details className="mb-8 rounded-xl border border-line bg-surface lg:hidden">
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">{title}</summary>
        <nav aria-label={navLabel} className="px-4 pb-4">
          {list}
        </nav>
      </details>
    );
  }

  return (
    <aside className="hidden lg:block">
      <nav aria-label={navLabel} className="sticky top-24">
        <p className="mb-3 text-sm font-semibold">{title}</p>
        {list}
      </nav>
    </aside>
  );
}
