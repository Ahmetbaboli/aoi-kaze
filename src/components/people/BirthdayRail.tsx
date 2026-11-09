import type { BirthdayCharacter } from '@/lib/catalog/types';
import RailScroller from '@/components/catalog/RailScroller';
import PersonCard from './PersonCard';

interface BirthdayRailProps {
  items: BirthdayCharacter[];
  title: string;
  hint: string;
  prevLabel: string;
  nextLabel: string;
}

/** Ana sayfa: bugün doğum günü olan sevilen karakterler (AniList'e ulaşılamazsa ya da kimse yoksa gizlenir). */
export default function BirthdayRail({ items, title, hint, prevLabel, nextLabel }: BirthdayRailProps) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="birthdays-title" className="mt-12">
      <div className="mb-2">
        <h2 id="birthdays-title" className="font-display text-2xl sm:text-3xl">
          <span aria-hidden="true">🎂 </span>
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </div>
      <RailScroller label={title} prev={prevLabel} next={nextLabel}>
        <ul className="flex gap-3">
          {items.map((character) => (
            <li key={character.id} className="w-32 shrink-0 sm:w-36">
              <PersonCard
                href={`/karakter/${character.id}`}
                name={character.name}
                image={character.image}
                caption={character.media?.title}
                accent={character.media?.color}
                sizes="144px"
              />
            </li>
          ))}
        </ul>
      </RailScroller>
    </section>
  );
}
