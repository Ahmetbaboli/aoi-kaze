import type { MediaSummary } from '@/lib/catalog/types';
import MediaCard from './MediaCard';
import type { CardLabels } from './card-labels';

export default function CatalogGrid({ items, labels }: { items: MediaSummary[]; labels: CardLabels }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {items.map((media, index) => (
        <li key={media.id} className="anim-stagger" style={{ ['--i' as string]: Math.min(index, 14) }}>
          <MediaCard media={media} labels={labels} priority={index < 6} />
        </li>
      ))}
    </ul>
  );
}
