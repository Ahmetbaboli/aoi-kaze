'use client';

import Link from '@/components/ui/LocLink';
import { useWatchlist } from '@/lib/watchlist';
import { fmt } from '@/lib/utils';
import CoverArt from './CoverArt';

interface ContinueRailProps {
  title: string;
  progressLabel: string;
  kinds: Record<string, string>;
}

/** "Devam et": listede "şu an takipteyim" olan eserler, en son güncellenen başta. Boşsa hiçbir şey göstermez. */
export default function ContinueRail({ title, progressLabel, kinds }: ContinueRailProps) {
  const entries = useWatchlist()
    .filter((entry) => entry.status === 'current')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 8);

  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="continue-title" className="mt-10">
      <h2 id="continue-title" className="mb-4 font-display text-2xl sm:text-3xl">
        {title}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {entries.map((entry, index) => (
          <li key={entry.id} className="anim-stagger" style={{ ['--i' as string]: index }}>
            <Link
              href={`/${entry.kind}/${entry.id}`}
              className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-2 transition hover:border-primary hover:shadow-cel"
            >
              <span className="relative block aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg bg-night">
                <CoverArt media={entry} sizes="56px" />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 block text-sm font-bold leading-tight group-hover:text-primary-text">{entry.title}</span>
                <span className="mt-1 block text-xs text-muted">
                  {kinds[entry.kind]}
                  {entry.progress ? ` · ${fmt(progressLabel, { n: entry.progress })}` : ''}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
