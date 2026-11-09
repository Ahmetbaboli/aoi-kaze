'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface RailScrollerProps {
  label: string;
  prev: string;
  next: string;
  children: ReactNode;
}

/** Yatay şerit: klavyeyle odaklanıp kaydırılır; masaüstünde sağ/sol oklar belirir. */
export default function RailScroller({ label, prev, next, children }: RailScrollerProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const scrollBy = (direction: 1 | -1) =>
    scroller.current?.scrollBy({ left: direction * scroller.current.clientWidth * 0.8, behavior: 'smooth' });

  const arrow =
    'anim-fade absolute top-1/3 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/90 text-xl text-fg shadow-cel backdrop-blur transition hover:bg-primary hover:text-white md:flex';

  return (
    <div className="relative">
      <div ref={scroller} role="region" aria-label={label} tabIndex={0} className="rail -mx-4 overflow-x-auto px-4 pb-4 pt-2 sm:-mx-6 sm:px-6">
        {children}
      </div>
      {!edges.start && (
        <button type="button" aria-label={prev} onClick={() => scrollBy(-1)} className={`${arrow} -left-3`}>
          <span aria-hidden="true">‹</span>
        </button>
      )}
      {!edges.end && (
        <button type="button" aria-label={next} onClick={() => scrollBy(1)} className={`${arrow} -right-3`}>
          <span aria-hidden="true">›</span>
        </button>
      )}
    </div>
  );
}
