import Link from '@/components/ui/LocLink';
import type { MediaSummary } from '@/lib/catalog/types';
import MediaCard from './MediaCard';
import RailScroller from './RailScroller';
import type { CardLabels } from './card-labels';

interface MediaRailProps {
  title: string;
  items: MediaSummary[];
  labels: CardLabels;
  hint: string;
  prevLabel?: string;
  nextLabel?: string;
  seeAll?: { href: string; label: string };
  /** Sıra numaralı "Top 10" görünümü */
  ranked?: boolean;
}

/** Yatay kaydırmalı poster şeridi (klavye ile odaklanıp ok tuşlarıyla kaydırılır). */
export default function MediaRail({ title, items, labels, hint, seeAll, ranked, prevLabel = '←', nextLabel = '→' }: MediaRailProps) {
  if (items.length === 0) return null;
  const shown = ranked ? items.slice(0, 10) : items;
  const headingId = `rail-${title.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <section aria-labelledby={headingId} className="mt-12">
      <div className="reveal">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 id={headingId} className="font-display text-2xl sm:text-3xl">
          {title}
        </h2>
        {seeAll && (
          <Link href={seeAll.href} className="shrink-0 text-sm font-semibold text-primary-text hover:underline">
            {seeAll.label} →
          </Link>
        )}
      </div>
      <RailScroller label={`${title} — ${hint}`} prev={prevLabel} next={nextLabel}>
        <ul className="flex snap-x snap-mandatory gap-4">
          {shown.map((media, i) => (
            <li key={media.id} className={ranked ? 'flex shrink-0 snap-start items-start' : 'w-36 shrink-0 snap-start sm:w-44'}>
              {ranked && (
                <span
                  aria-hidden="true"
                  className="-mr-3 mt-[8.5rem] select-none text-7xl font-black leading-none text-transparent [-webkit-text-stroke:2px_rgb(var(--muted))] sm:mt-[11rem] sm:text-8xl"
                >
                  {i + 1}
                </span>
              )}
              <div className="w-36 sm:w-44">
                <MediaCard media={media} labels={labels} />
              </div>
            </li>
          ))}
        </ul>
      </RailScroller>
      </div>
    </section>
  );
}
