import type { Metadata } from 'next';
import Image from 'next/image';
import Link from '@/components/ui/LocLink';
import { notFound, redirect } from 'next/navigation';
import { getContent } from '@/content';
import { getDetail, isKind } from '@/lib/catalog';
import { localePath, type Locale } from '@/lib/i18n';
import { alternatesFor } from '@/lib/seo';
import { fmt } from '@/lib/utils';
import { cardLabels } from '@/components/catalog/card-labels';
import CoverArt from '@/components/catalog/CoverArt';
import MediaRail from '@/components/catalog/MediaRail';
import UnavailableNotice from '@/components/catalog/UnavailableNotice';
import TrailerEmbed from '@/components/catalog/TrailerEmbed';
import WatchlistControls from '@/components/catalog/WatchlistControls';
import PageContainer from '@/components/layout/PageContainer';
import Card from '@/components/ui/Card';
import { mediaThemeVars, moodFor } from '@/lib/media-theme';
import type { CSSProperties } from 'react';

interface DetailPageProps {
  params: { locale: Locale; kind: string; id: string };
}

// Her istekte render edilir: AniList hatası önbelleğe girmesin. Başarılı yanıtlar fetch önbelleğinde 1 saat tutulur.
export const dynamic = 'force-dynamic';

const parseId = (value: string) => (/^\d{1,9}$/.test(value) ? Number(value) : null);

export async function generateMetadata({ params }: DetailPageProps): Promise<Metadata> {
  const id = parseId(params.id);
  if (!isKind(params.kind) || id === null) return {};
  const result = await getDetail(id, params.locale);
  if (result.status !== 'ok') return {};
  const { media } = result;

  const description = media.description.replace(/\s+/g, ' ').slice(0, 160);
  const path = `/${media.kind}/${media.id}`;
  return {
    title: media.title,
    description,
    alternates: alternatesFor(path, params.locale),
    openGraph: {
      type: 'website',
      title: media.title,
      description,
      url: localePath(params.locale, path),
      images: media.cover ? [{ url: media.cover }] : undefined,
    },
    twitter: { card: 'summary_large_image', title: media.title, description },
  };
}

export default async function DetailPage({ params }: DetailPageProps) {
  const id = parseId(params.id);
  if (!isKind(params.kind) || id === null) notFound();

  const result = await getDetail(id, params.locale);
  if (result.status === 'missing') notFound();
  const c = getContent(params.locale);
  if (result.status === 'unavailable') {
    return (
      <PageContainer>
        <UnavailableNotice title={c.catalog.unavailable.title} text={c.catalog.unavailable.text} />
      </PageContainer>
    );
  }
  const { media } = result;
  // Örn. /manga/123 aslında bir manhwa ise doğru adrese yönlendir.
  if (media.kind !== params.kind) redirect(localePath(params.locale, `/${media.kind}/${media.id}`));

  const d = c.catalog.detail;
  const accent = media.color ?? '#475569';
  // Sayfa eserin rengine bürünür (düğmeler, rozetler, bağlantılar); renk kontrast eşiğine göre ayarlanır.
  const theme = mediaThemeVars(media.color);
  const mood = moodFor(media.genres);
  const dateFormat = new Intl.DateTimeFormat(c.locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: c.catalog.schedule.timezone });

  const rows: [string, string | null][] = [
    [d.format, media.format ? c.catalog.formats[media.format] ?? media.format : null],
    [d.status, media.status ? c.catalog.statuses[media.status] ?? media.status : null],
    [media.kind === 'anime' ? d.episodes : d.chapters, (media.episodes ?? media.chapters)?.toString() ?? null],
    [d.volumes, media.volumes?.toString() ?? null],
    [d.duration, media.duration ? fmt(d.durationValue, { n: media.duration }) : null],
    [d.season, media.season ? c.catalog.seasons[media.season] ?? media.season : null],
    [d.year, media.year?.toString() ?? null],
  ];

  return (
    <div className={theme ? 'media-theme media-glow' : undefined} style={(theme ?? undefined) as CSSProperties | undefined}>
      <div className="relative h-56 overflow-hidden bg-night sm:h-80">
        {media.banner ? (
          <Image src={media.banner} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${accent}, #0A0A10 85%)` }} />
        )}
        <div aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-overlay" style={{ background: accent }} />
        {mood && theme && <div aria-hidden="true" data-mood={mood} className={`absolute inset-0 mood-${mood}`} />}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
      </div>

      <PageContainer className="-mt-32 py-0 sm:-mt-44">
        <Link href={`/${media.kind}`} className="relative mb-6 inline-block text-sm font-semibold text-primary-text hover:underline">
          {fmt(d.back, { kind: c.catalog.kindLabel[media.kind] })}
        </Link>

        <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
          <div className="mx-auto w-44 md:w-full">
            <Card className="shadow-cel">
              <div className="relative aspect-[2/3] bg-night">
                <CoverArt media={media} priority sizes="(min-width: 768px) 14rem, 11rem" />
              </div>
            </Card>
          </div>

          <div className="min-w-0 pt-2 md:pt-20">
            <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold">
              <span className="rounded-md bg-primary px-2 py-0.5 text-white">{c.catalog.kindLabel[media.kind]}</span>
              {media.score != null && (
                <span className="rounded-md bg-volt px-2 py-0.5 text-ink" role="img" aria-label={fmt(c.catalog.scoreLabel, { n: media.score })}>
                  <span aria-hidden="true">★ {(media.score / 10).toFixed(1)}</span>
                </span>
              )}
            </p>
            <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-5xl" style={{ textShadow: `0 2px 24px ${accent}66` }}>
              {media.title}
            </h1>
            {media.titleNative && (
              <p lang="ja" className="mt-2 text-lg text-muted">
                {media.titleNative}
              </p>
            )}

            <ul className="mt-4 flex flex-wrap gap-2" aria-label={d.genres}>
              {media.genres.map((genre) => (
                <li key={genre}>
                  <Link
                    href={`/${media.kind}?genre=${encodeURIComponent(genre)}`}
                    className="block rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold transition hover:bg-fg/5"
                  >
                    {c.catalog.genres[genre] ?? genre}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <WatchlistControls
                media={{ id: media.id, kind: media.kind, title: media.title, cover: media.cover, color: media.color, total: media.episodes ?? media.chapters, genres: media.genres }}
                labels={c.catalog.watchlist}
                total={media.episodes ?? media.chapters}
              />
            </div>

            {media.nextEpisode && (
              <div className="mt-8">
                <div className="rounded-xl border border-line bg-surface shadow-cel-sm inline-block px-5 py-3 font-bold">
                  {fmt(d.nextEpisode, { n: media.nextEpisode.episode, date: dateFormat.format(media.nextEpisode.airingAt * 1000) })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-12">
            <section aria-labelledby="synopsis">
              <h2 id="synopsis" className="mb-3 font-display text-2xl">
                {d.synopsis}
              </h2>
              <p lang="en" className="whitespace-pre-line text-lg leading-8">
                {media.description || d.noDescription}
              </p>
              {media.description && <p className="mt-2 text-sm text-muted">{d.synopsisNote}</p>}
            </section>

            {(media.concept || media.themes?.length || media.tags.length > 0) && (
              <section aria-labelledby="concept" className="rounded-2xl border border-line bg-surface p-5" style={{ borderTop: `3px solid ${accent}` }}>
                <h2 id="concept" className="mb-3 font-display text-2xl">
                  {d.concept}
                </h2>
                {media.concept && <p className="text-lg leading-8">{media.concept}</p>}
                {(media.themes?.length || media.tags.length > 0) && (
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label={d.tagsTitle}>
                    {(media.themes ?? media.tags.map((tag) => tag.name)).map((name) => (
                      <li key={name} className="rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ background: `${accent}cc` }}>
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {media.trailerId && (
              <section aria-labelledby="trailer">
                <h2 id="trailer" className="mb-3 font-display text-2xl">
                  {d.trailer}
                </h2>
                <TrailerEmbed videoId={media.trailerId} title={fmt(d.trailerTitle, { title: media.title })} loadLabel={d.loadTrailer} note={d.trailerNote} />
              </section>
            )}

            {media.characters.length > 0 && (
              <section aria-labelledby="characters">
                <h2 id="characters" className="mb-3 font-display text-2xl">
                  {d.characters}
                </h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {media.characters.map((character) => {
                    const card = (
                      <>
                        <div className="relative aspect-[3/4] overflow-hidden bg-night">
                          {character.image ? (
                            <Image src={character.image} alt="" fill sizes="(min-width: 768px) 12vw, 30vw" className="object-cover transition duration-300 group-hover:scale-105" />
                          ) : (
                            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-4xl font-black text-white/70" style={{ background: `linear-gradient(160deg, ${accent}, #0A0A10)` }}>
                              {character.name.slice(0, 1)}
                            </span>
                          )}
                          {character.role && (
                            <span className="absolute left-2 top-2 rounded-md bg-night/80 px-1.5 py-0.5 text-[0.65rem] font-bold text-white">
                              {c.people.roles[character.role] ?? character.role}
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 px-2 pt-2 text-sm font-semibold leading-tight group-hover:text-primary-text">{character.name}</p>
                      </>
                    );
                    return (
                      <li key={character.id ?? character.name} className="group overflow-hidden rounded-xl border border-line bg-surface pb-2 transition hover:-translate-y-0.5">
                        {character.id ? (
                          <Link href={`/karakter/${character.id}`} className="block">
                            {card}
                          </Link>
                        ) : (
                          card
                        )}
                        {character.voiceActor && (
                          <Link href={`/kisi/${character.voiceActor.id}`} className="mt-0.5 block truncate px-2 text-xs text-muted hover:text-primary-text hover:underline">
                            {fmt(c.people.voicedBy, { name: character.voiceActor.name })}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {media.episodeList.length > 0 && (
              <section aria-labelledby="episodes">
                <h2 id="episodes" className="mb-1 font-display text-2xl">
                  {d.episodesTitle}
                </h2>
                <p className="mb-3 text-sm text-muted">{d.episodesNote}</p>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {media.episodeList.map((episode) => (
                    <li key={episode.url}>
                      <a
                        href={episode.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="group flex gap-3 overflow-hidden rounded-xl border border-line bg-surface p-2 transition hover:border-primary"
                      >
                        <span className="relative block aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-night">
                          {episode.thumbnail && <Image src={episode.thumbnail} alt="" fill sizes="128px" className="object-cover transition duration-300 group-hover:scale-105" />}
                        </span>
                        <span className="min-w-0 self-center">
                          <span className="line-clamp-2 block text-sm font-semibold">{episode.title}</span>
                          {episode.site && <span className="block text-xs text-muted">{episode.site} ↗</span>}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="space-y-8">
            <Card innerClassName="p-5">
              <h2 className="mb-3 font-display text-lg">{d.info}</h2>
              <dl className="space-y-2 text-sm">
                {rows
                  .filter((row): row is [string, string] => row[1] !== null)
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 border-b border-line pb-1">
                      <dt className="font-semibold">{label}</dt>
                      <dd className="text-right text-muted">{value}</dd>
                    </div>
                  ))}
                {media.studios.length > 0 && (
                  <div className="flex justify-between gap-4 border-b border-line pb-1">
                    <dt className="font-semibold">{d.studios}</dt>
                    <dd className="text-right text-muted">
                      {media.studioLinks?.length
                        ? media.studioLinks.map((studio, i) => (
                            <span key={studio.id}>
                              {i > 0 && ', '}
                              <Link href={`/studyo/${studio.id}`} className="font-semibold text-primary-text hover:underline">
                                {studio.name}
                              </Link>
                            </span>
                          ))
                        : media.studios.join(', ')}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>

            <Card tone="night" innerClassName="p-5">
              <h2 className="mb-3 font-display text-lg">{d.watch}</h2>
              {media.watchLinks.length > 0 ? (
                <ul className="space-y-2">
                  {media.watchLinks.map((link) => (
                    <li key={link.url}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="block rounded-lg border border-[#F1F3FA]/30 px-3 py-2 text-sm font-semibold transition hover:bg-white/10"
                      >
                        {link.site} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm">{d.watchNone}</p>
              )}
              <p className="mt-3 text-xs text-[#F1F3FA]/80">{d.watchNote}</p>
            </Card>
          </aside>
        </div>

        <MediaRail title={d.similar} items={media.recommendations} labels={cardLabels(c)} hint={c.home.railHint} prevLabel={c.home.railPrev} nextLabel={c.home.railNext} />
      </PageContainer>
    </div>
  );
}
