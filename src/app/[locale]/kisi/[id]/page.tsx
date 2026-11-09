import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContent } from '@/content';
import { getStaff } from '@/lib/catalog';
import type { Locale } from '@/lib/i18n';
import { alternatesFor } from '@/lib/seo';
import { factRows, formatBirthday, parseId } from '@/lib/people-format';
import { fmt } from '@/lib/utils';
import { cardLabels } from '@/components/catalog/card-labels';
import MediaCard from '@/components/catalog/MediaCard';
import UnavailableNotice from '@/components/catalog/UnavailableNotice';
import PageContainer from '@/components/layout/PageContainer';
import PersonCard from '@/components/people/PersonCard';
import PersonHero from '@/components/people/PersonHero';
import RichTextView from '@/components/people/RichTextView';

interface StaffPageProps {
  params: { locale: Locale; id: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: StaffPageProps): Promise<Metadata> {
  const id = parseId(params.id);
  if (id === null) return {};
  const result = await getStaff(id);
  if (result.status !== 'ok') return {};
  const st = result.data;
  return {
    title: st.name,
    alternates: alternatesFor(`/kisi/${st.id}`, params.locale),
    openGraph: { type: 'profile', title: st.name, images: st.image ? [{ url: st.image }] : undefined },
  };
}

export default async function StaffPage({ params }: StaffPageProps) {
  const id = parseId(params.id);
  if (id === null) notFound();
  const result = await getStaff(id);
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

  const st = result.data;
  const dateLocale = params.locale === 'tr' ? 'tr-TR' : 'en-US';
  const years = st.yearsActive.length ? `${st.yearsActive[0]} – ${st.yearsActive[1] ?? p.present}` : null;
  const facts = factRows([
    [p.occupations, st.occupations.join(', ')],
    [p.language, st.language ? p.languages[st.language] ?? st.language : null],
    [p.gender, st.gender ? p.genders[st.gender] ?? st.gender : null],
    [p.age, st.age],
    [p.birthday, formatBirthday(st.birthday, dateLocale)],
    [p.homeTown, st.homeTown],
    [p.yearsActive, years],
  ]);

  return (
    <PageContainer>
      <PersonHero
        name={st.name}
        nameNative={st.nameNative}
        image={st.image}
        facts={facts}
        factsTitle={p.facts}
        subtitle={st.favourites ? <span className="rounded-md bg-volt px-2 py-0.5 text-ink">♥ {fmt(p.favourites, { n: st.favourites.toLocaleString(dateLocale) })}</span> : null}
      >
        <h2 className="sr-only">{p.about}</h2>
        {st.description.length > 0 ? <RichTextView text={st.description} labels={{ spoilerShow: p.spoilerShow, spoilerHide: p.spoilerHide }} className="max-w-3xl text-lg" /> : <p className="text-muted">{p.noDescription}</p>}
      </PersonHero>

      {st.roles.length > 0 && (
        <section aria-labelledby="voiced" className="mt-14">
          <h2 id="voiced" className="mb-4 font-display text-2xl">
            {p.staff.voiced}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {st.roles.map(({ character, media, role }) => (
              <li key={`${character.id}-${media?.id ?? 0}`}>
                <PersonCard
                  href={`/karakter/${character.id}`}
                  name={character.name}
                  image={character.image}
                  accent={media?.color}
                  caption={media ? fmt(p.staff.in, { title: media.title }) : role ? p.roles[role] ?? role : null}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {st.works.length > 0 && (
        <section aria-labelledby="works" className="mt-14">
          <h2 id="works" className="mb-4 font-display text-2xl">
            {p.staff.works}
          </h2>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {st.works.map(({ media, role }) => (
              <li key={media.id}>
                <MediaCard media={media} labels={cardLabels(c)} />
                {role && <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-muted">{role}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
