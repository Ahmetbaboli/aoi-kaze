'use client';

import { useEffect, useRef } from 'react';

interface ReadingProgressProps {
  /** İlerlemesi ölçülecek makalenin id'si */
  targetId: string;
  label: string;
}

/** Sayfanın üstünde, manga sayfa çevirme hissi veren ince okuma çubuğu. */
export default function ReadingProgress({ targetId, label }: ReadingProgressProps) {
  const bar = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = target.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight * 0.6;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 1;
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
      root.current?.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [targetId]);

  return (
    <div
      ref={root}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1"
    >
      <div
        ref={bar}
        className="h-full origin-left bg-primary"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}
