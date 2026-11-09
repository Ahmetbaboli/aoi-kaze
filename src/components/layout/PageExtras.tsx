'use client';

import { useEffect, useState } from 'react';

/** Sayfa geneli kolaylıklar: "/" ile aramaya odaklan, aşağı inince "başa dön" düğmesi. */
export default function PageExtras({ topLabel }: { topLabel: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 700);
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key !== '/' || event.ctrlKey || event.metaKey || target.closest('input, textarea, select, [contenteditable]')) return;
      const search = document.getElementById('nav-q') ?? document.getElementById('live-search');
      if (search) {
        event.preventDefault();
        search.focus();
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      aria-label={topLabel}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="anim-fade fixed bottom-6 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface/90 shadow-cel backdrop-blur transition hover:bg-primary hover:text-white sm:left-6"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
