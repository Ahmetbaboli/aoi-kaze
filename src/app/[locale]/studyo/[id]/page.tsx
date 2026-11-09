import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContent } from '@/content';
import { getStudio } from '@/lib/catalog';
import type { Locale } from '@/lib/i18n';
import { alternatesFor } from '@/lib/seo';
import { parseId } from '@/lib/people-format';
import { fmt } from '@/lib/utils';
import { cardLabels } from '@/components/catalog/card-labels';
import MediaCard from '@/components/catalog/MediaCard';
import UnavailableNotice from '@/components/catalog/UnavailableNotice';
import PageContainer from '@/components/layout/PageContainer';

interface StudioPageProps {
  params: { locale: Locale; id: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: StudioPageProps): Promise<Metadata> {
  const id = parseId(params.id);
  if (id === null) return {};
  const result = await getStudio(id);
  if (result.status !== 'ok') return {};
  return { title: result.data.name, alternates: alternatesFor(`/studyo/${result.data.id}`, params.locale) };
}

export default async function StudioPage({ params }: StudioPageProps) {
  const id = parseId(params.id);
  if (id === null) notFound();
  const result = await getStudio(id);
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

  const studio = result.data;
  // Stüdyonun en popüler eserinin renginden hafif bir başlık ışıması.
  const glow = studio.media.find((m) => m.color)?.color ?? '#e11d48';
  const dateLocale = params.locale === 'tr' ? 'tr-TR' : 'en-US';

  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <div aria-hidden="true" className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(50rem 20rem at 10% 0%, ${glow}, transparent 70%)` }} />
        <PageContainer className="relative py-12 sm:py-16">
          <p className="mb-2 text-sm font-bold">
            <span className="rounded-md bg-primary px-2 py-0.5 text-white">{studio.isAnimationStudio ? p.studio.animation : p.studio.producer}</span>
          </p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{studio.name}</h1>
          {studio.favourites ? <p className="mt-3 font-semibold text-muted">♥ {fmt(p.favourites, { n: studio.favourites.toLocaleString(dateLocale) })}</p> : null}
        </PageContainer>
      </div>

      <PageContainer>
        <h2 className="mb-4 font-display text-2xl">{p.studio.works}</h2>
        {studio.media.length === 0 ? (
          <p className="text-muted">{p.studio.empty}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {studio.media.map((media) => (
              <li key={media.id}>
                <MediaCard media={media} labels={cardLabels(c)} />
              </li>
            ))}
          </ul>
        )}
      </PageContainer>
    </div>
  );
}
