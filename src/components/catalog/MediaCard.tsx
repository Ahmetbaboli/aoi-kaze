import Link from '@/components/ui/LocLink';
import type { MediaSummary } from '@/lib/catalog/types';
import { fmt } from '@/lib/utils';
import CoverArt from './CoverArt';
import type { CardLabels } from './card-labels';

interface MediaCardProps {
  media: MediaSummary;
  labels: CardLabels;
  priority?: boolean;
}

/** Poster kartı: hover'da yakınlaşır, alttan karartma ile başlık ve türler açılır. */
export default function MediaCard({ media, labels, priority }: MediaCardProps) {
  const count =
    media.episodes != null
      ? fmt(labels.episodes, { n: media.episodes })
      : media.chapters != null
        ? fmt(labels.chapters, { n: media.chapters })
        : null;
  const meta = [media.format ? labels.formats[media.format] ?? media.format : null, media.year, count]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link href={`/${media.kind}/${media.id}`} aria-label={fmt(labels.open, { title: media.title })} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-night shadow-cel-sm transition duration-200 group-hover:z-10 group-hover:scale-[1.04] group-hover:shadow-cel-lg group-focus-visible:scale-[1.04]">
        <CoverArt media={media} priority={priority} sizes="(min-width: 1024px) 15vw, (min-width: 640px) 25vw, 45vw" />
        {media.score != null && (
          <span
            className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-bold text-volt backdrop-blur"
            role="img"
            aria-label={fmt(labels.score, { n: media.score })}
          >
            <span aria-hidden="true">★</span>
            <span aria-hidden="true">{(media.score / 10).toFixed(1)}</span>
          </span>
        )}
        <span className="absolute right-2 top-2 z-10 rounded-md bg-primary px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
          {labels.kinds[media.kind]}
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-10 flex translate-y-2 flex-col gap-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-10 text-white opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
        >
          {meta && <span className="text-[0.7rem] text-white/80">{meta}</span>}
          {media.genres.length > 0 && <span className="line-clamp-1 text-[0.7rem] font-semibold">{media.genres.slice(0, 3).join(' · ')}</span>}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-bold leading-tight group-hover:text-primary-text">{media.title}</p>
      {meta && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{meta}</p>}
    </Link>
  );
}
