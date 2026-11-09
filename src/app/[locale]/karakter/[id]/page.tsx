import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContent } from '@/content';
import { getCharacter } from '@/lib/catalog';
import type { Locale } from '@/lib/i18n';
import { alternatesFor } from '@/lib/seo';
import { factRows, formatBirthday, parseId } from '@/lib/people-format';
import { cardLabels } from '@/components/catalog/card-labels';
import MediaCard from '@/components/catalog/MediaCard';
import UnavailableNotice from '@/components/catalog/UnavailableNotice';
import PageContainer from '@/components/layout/PageContainer';
import PersonCard from '@/components/people/PersonCard';
import PersonHero from '@/components/people/PersonHero';
import RichTextView from '@/components/people/RichTextView';
import { fmt } from '@/lib/utils';

interface CharacterPageProps {
  params: { locale: Locale; id: string };
}

// Her istekte render edilir: AniList hatası önbelleğe girmesin. Başarılı yanıtlar fetch önbelleğinde 1 saat tutulur.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: CharacterPageProps): Promise<Metadata> {
  const id = parseId(params.id);
  if (id === null) return {};
  const result = await getCharacter(id);
  if (result.status !== 'ok') return {};
  const ch = result.data;
  const description = ch.description.flat().filter((s) => s.kind === 'text').map((s) => s.text).join(' ').slice(0, 160);
  return {
    title: ch.name,
    description: description || undefined,
    alternates: alternatesFor(`/karakter/${ch.id}`, params.locale),
    openGraph: { type: 'profile', title: ch.name, images: ch.image ? [{ url: ch.image }] : undefined },
  };
}

export default async function CharacterPage({ params }: CharacterPageProps) {
  const id = parseId(params.id);
  if (id === null) notFound();
  const result = await getCharacter(id);
  if (result.status === 'missing') notFound();
  const c = getContent(params.locale);
  const p = c.people;
  if (result.status === 'unavailable') {
    return (
      <PageContainer>
        <UnavailableNotice title={p.unavailableTitle} text={p.unavailableText} />
      </PageContainer>
    );
  }

  const ch = result.data;
  const dateLocale = params.locale === 'tr' ? 'tr-TR' : 'en-US';
  const facts = factRows([
    [p.gender, ch.gender ? p.genders[ch.gender] ?? ch.gender : null],
    [p.age, ch.age],
    [p.birthday, formatBirthday(ch.birthday, dateLocale)],
    [p.bloodType, ch.bloodType],
    // AniList açıklamasındaki ek bilgi satırları (boy, meslek...). Aynı başlık iki kez gösterilmez.
    ...ch.facts.filter((f) => !/^(age|birthday|blood ?type|gender)$/i.test(f.label)).map((f): [string, string] => [f.label, f.value]),
  ]);
  const mainRole = ch.appearances.find((a) => a.role === 'MAIN') ?? ch.appearances[0];

  return (
    <PageContainer>
      <PersonHero
        name={ch.name}
        nameNative={ch.nameNative}
        image={ch.image}
        facts={facts}
        factsTitle={p.facts}
        subtitle={
          <>
            {mainRole?.role && <span className="rounded-md bg-primary px-2 py-0.5 text-white">{p.roles[mainRole.role] ?? mainRole.role}</span>}
            {ch.favourites ? <span className="rounded-md bg-volt px-2 py-0.5 text-ink">♥ {fmt(p.favourites, { n: ch.favourites.toLocaleString(dateLocale) })}</span> : null}
            {ch.alternative.length > 0 && (
              <span className="text-muted">
                {p.alternative}: {ch.alternative.join(', ')}
              </span>
            )}
          </>
        }
      >
        <h2 className="sr-only">{p.about}</h2>
        {ch.description.length > 0 ? <RichTextView text={ch.description} labels={{ spoilerShow: p.spoilerShow, spoilerHide: p.spoilerHide }} className="max-w-3xl text-lg" /> : <p className="text-muted">{p.noDescription}</p>}
      </PersonHero>

      <section aria-labelledby="voice" className="mt-14">
        <h2 id="voice" className="mb-4 font-display text-2xl">
          {p.character.voiceActors}
        </h2>
        {ch.voiceActors.length === 0 ? (
          <p className="text-muted">{p.character.noVoice}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {ch.voiceActors.map((va) => (
              <li key={va.id}>
                <PersonCard href={`/kisi/${va.id}`} name={va.name} image={va.image} caption={va.language ? p.languages[va.language] ?? va.language : null} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {ch.appearances.length > 0 && (
        <section aria-labelledby="appearances" className="mt-14">
          <h2 id="appearances" className="mb-4 font-display text-2xl">
            {p.character.appearances}
          </h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {ch.appearances.map(({ media, role }) => (
              <li key={media.id}>
                <MediaCard media={media} labels={cardLabels(c)} />
                {role && <p className="mt-1.5 text-xs font-semibold text-muted">{p.roles[role] ?? role}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
