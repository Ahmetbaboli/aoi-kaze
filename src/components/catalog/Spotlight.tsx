'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useReducedMotion } from 'framer-motion';
import type { SpotlightItem } from '@/lib/catalog/types';
import { fmt } from '@/lib/utils';
import Button from '@/components/ui/Button';
import CoverArt from './CoverArt';

interface SpotlightProps {
  items: SpotlightItem[];
  labels: {
    region: string;
    pick: string;
    pause: string;
    play: string;
    details: string;
    score: string;
    kinds: Record<string, string>;
    genres: Record<string, string>;
  };
}

const INTERVAL_MS = 7000;

/** Tam genişlikte vitrin: büyük afiş, başlık, özet ve altta küçük kapaklarla seçim. Otomatik geçiş durdurulabilir. */
export default function Spotlight({ items, labels }: SpotlightProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);

  const auto = playing && !hovered && !reduceMotion && items.length > 1;

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % items.length), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [auto, items.length]);

  if (items.length === 0) return null;
  const item = items[index];
  const color = item.color ?? '#475569';

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.region}
      className="relative overflow-hidden bg-night text-[#F1F3FA]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className="relative min-h-[30rem] sm:min-h-[36rem] lg:min-h-[40rem]">
        <div key={item.id} className="anim-fade absolute inset-0">
          <div className={reduceMotion ? 'absolute inset-0' : 'anim-kenburns absolute inset-0'}>
            {item.banner ? (
              <Image src={item.banner} alt="" fill priority={index === 0} sizes="100vw" className="object-cover object-center" />
            ) : (
              <div aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${color}, #06060A 80%)` }} />
            )}
          </div>
        </div>
        <div aria-hidden="true" className={`absolute inset-0 bg-gradient-to-r from-[#0A0A10] to-transparent ${item.banner ? 'via-[#0A0A10]/70' : 'via-[#0A0A10]/30'}`} />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />

        {!item.banner && (
          <div aria-hidden="true" className="absolute right-[max(1.5rem,calc((100%-72rem)/2+1.5rem))] top-1/2 hidden aspect-[2/3] w-60 -translate-y-1/2 rotate-3 overflow-hidden rounded-2xl border border-white/10 shadow-cel-lg lg:block">
            <CoverArt media={item} sizes="240px" />
          </div>
        )}

        <div
          className="relative mx-auto flex min-h-[30rem] max-w-6xl flex-col justify-end gap-4 px-4 pb-32 pt-16 sm:min-h-[36rem] sm:px-6 lg:min-h-[40rem] lg:pb-36 lg:pr-[22rem]"
          aria-live={auto ? 'off' : 'polite'}
        >
          <div key={item.id} className="anim-hero flex flex-col gap-4">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="rounded-md bg-primary px-2 py-0.5 text-white">{labels.kinds[item.kind]}</span>
            {item.score != null && (
              <span className="rounded-md bg-volt px-2 py-0.5 text-ink" role="img" aria-label={fmt(labels.score, { n: item.score })}>
                <span aria-hidden="true">★ {(item.score / 10).toFixed(1)}</span>
              </span>
            )}
            {item.year && <span className="text-[#F1F3FA]/80">{item.year}</span>}
            {item.genres.slice(0, 3).map((genre) => (
              <span key={genre} className="text-[#F1F3FA]/80">
                · {labels.genres[genre] ?? genre}
              </span>
            ))}
          </p>
          <h2 className="max-w-3xl font-display text-4xl leading-tight tracking-tight drop-shadow-lg sm:text-6xl">{item.title}</h2>
          {item.description && <p className="line-clamp-3 max-w-xl text-base text-[#F1F3FA]/85 sm:text-lg">{item.description}</p>}
          <div className="mt-2">
            <Button href={`/${item.kind}/${item.id}`} className="!px-7 !py-3 !text-base">
              {labels.details}
            </Button>
          </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-6">
          <div className="mx-auto flex max-w-6xl items-end gap-3 px-4 sm:px-6">
            <ul className="flex gap-2 overflow-x-auto pb-1">
              {items.map((entry, i) => (
                <li key={entry.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={fmt(labels.pick, { title: entry.title })}
                    aria-current={i === index ? 'true' : undefined}
                    className={`relative block h-20 w-14 overflow-hidden rounded-lg border-2 bg-surface transition sm:h-24 sm:w-16 ${
                      i === index ? 'border-primary opacity-100' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <CoverArt media={entry} sizes="64px" />
                    {i === index && auto && <span key={index} aria-hidden="true" className="anim-progress absolute inset-x-0 bottom-0 h-1 bg-primary" />}
                  </button>
                </li>
              ))}
            </ul>
            {!reduceMotion && items.length > 1 && (
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? labels.pause : labels.play}
                className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F3FA]/15 text-[#F1F3FA] backdrop-blur hover:bg-[#F1F3FA]/25"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  {playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M7 4l13 8-13 8z" />}
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
