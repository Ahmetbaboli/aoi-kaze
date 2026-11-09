import Link from '@/components/ui/LocLink';
import { getContent } from '@/content';
import { getBirthdays, getHome, getSchedule, GENRES } from '@/lib/catalog';
import BirthdayRail from '@/components/people/BirthdayRail';
import { localePath, type LocaleParams } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import { cardLabels } from '@/components/catalog/card-labels';
import MediaRail from '@/components/catalog/MediaRail';
import UnavailableNotice from '@/components/catalog/UnavailableNotice';
import Spotlight from '@/components/catalog/Spotlight';
import SurpriseButton from '@/components/catalog/SurpriseButton';
import ContinueRail from '@/components/catalog/ContinueRail';
import CoverArt from '@/components/catalog/CoverArt';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';

export const generateMetadata = ({ params }: LocaleParams) => pageMetadata('home', '/', params.locale);
// Her istekte render edilir: AniList hatası önbelleğe girmesin (başarılı yanıtlar fetch önbelleğinde 1 saat tutulur).
export const dynamic = 'force-dynamic';

export default async function HomePage({ params }: LocaleParams) {
  const c = getContent(params.locale);
  const now = Date.now();
  const [home, schedule, birthdays] = await Promise.all([
    getHome(),
    getSchedule(Math.floor(now / 1000), Math.floor((now + 86_400_000) / 1000)),
    getBirthdays(),
  ]);
  const airing = (schedule ?? []).slice(0, 12);
  const timeFormat = new Intl.DateTimeFormat(c.locale, { timeZone: c.catalog.schedule.timezone, hour: '2-digit', minute: '2-digit' });
  const labels = cardLabels(c);
  const h = c.home;

  const hasSpotlight = home.spotlight.length > 0;

  return (
    <>
      <h1 className="sr-only">{h.title}</h1>
        <Spotlight
          items={home.spotlight}
          labels={{
            region: h.spotlightLabel,
            pick: h.spotlightPick,
            pause: h.spotlightPause,
            play: h.spotlightPlay,
            details: h.details,
            score: c.catalog.scoreLabel,
            kinds: c.catalog.kindLabel,
            genres: c.catalog.genres,
          }}
        />

      <PageContainer className={hasSpotlight ? 'pt-6 sm:pt-6' : 'pt-8 sm:pt-10'}>
        {home.source === 'curated' && <UnavailableNotice title={c.catalog.curated.title} text={c.catalog.curated.text} />}

        {!hasSpotlight && (
          <header className="relative mb-8 grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <p className="mb-3 text-sm font-semibold text-primary-text">{h.eyebrow}</p>
              <p className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">{h.title}</p>
              <p className="mt-4 max-w-xl text-lg text-muted">{h.subtitle}</p>
            </div>
            <form action={localePath(params.locale, '/ara')} method="get" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end lg:justify-end">
              <div className="flex-1">
                <label htmlFor="home-q" className="mb-1 block text-sm font-semibold">
                  {h.searchLabel}
                </label>
                <input id="home-q" name="q" type="search" placeholder={h.searchPlaceholder} minLength={2} maxLength={60} className="field !py-2.5" />
              </div>
              <Button type="submit">
                {h.searchButton}
              </Button>
            </form>
    
          </header>
        )}

      <ContinueRail title={h.continueTitle} progressLabel={h.progressShort} kinds={c.catalog.kindLabel} />

      {airing.length > 0 && (
        <section aria-labelledby="airing-title" className="mt-12">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="airing-title" className="font-display text-2xl sm:text-3xl">
              {h.airingTitle}
            </h2>
            <Link href="/takvim" className="shrink-0 text-sm font-semibold text-primary-text hover:underline">
              {h.seeAll} →
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {airing.map((entry, index) => (
              <li key={`${entry.media.id}-${entry.episode}`} className="anim-stagger" style={{ ['--i' as string]: index }}>
                <Link
                  href={`/anime/${entry.media.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-2 transition hover:border-primary hover:shadow-cel"
                >
                  <span className="relative block aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md bg-night">
                    <CoverArt media={entry.media} sizes="48px" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-extrabold text-primary-text">{timeFormat.format(entry.airingAt * 1000)}</span>
                    <span className="line-clamp-1 block text-sm font-bold group-hover:text-primary-text">{entry.media.title}</span>
                    <span className="block text-xs text-muted">{h.airingEpisode.replace('{n}', String(entry.episode))}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SurpriseButton items={[...home.seasonal, ...home.topAnime]} label={h.surprise} hint={h.surpriseHint} />

      <MediaRail title={h.rails.seasonal} items={home.seasonal} labels={labels} hint={h.railHint} prevLabel={h.railPrev} nextLabel={h.railNext} seeAll={{ href: '/anime?sort=trending', label: h.seeAll }} />
      <MediaRail title={h.rails.topAnime} items={home.topAnime} ranked labels={labels} hint={h.railHint} prevLabel={h.railPrev} nextLabel={h.railNext} seeAll={{ href: '/anime?sort=score', label: h.seeAll }} />
      <BirthdayRail items={birthdays} title={c.people.birthdays.title} hint={c.people.birthdays.hint} prevLabel={h.railPrev} nextLabel={h.railNext} />
      <MediaRail title={h.rails.trendingManga} items={home.trendingManga} labels={labels} hint={h.railHint} prevLabel={h.railPrev} nextLabel={h.railNext} seeAll={{ href: '/manga?sort=trending', label: h.seeAll }} />
      <MediaRail title={h.rails.trendingManhwa} items={home.trendingManhwa} labels={labels} hint={h.railHint} prevLabel={h.railPrev} nextLabel={h.railNext} seeAll={{ href: '/manhwa?sort=trending', label: h.seeAll }} />

      <section aria-labelledby="mood-title" className="mt-16">
        <h2 id="mood-title" className="mb-5 font-display text-2xl sm:text-3xl">
          {h.moodTitle}
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {h.moods.map((mood, index) => (
            <li key={mood.genre} className="anim-stagger" style={{ ['--i' as string]: index }}>
              <Link
                href={`/anime?genre=${encodeURIComponent(mood.genre)}`}
                className="group relative block overflow-hidden rounded-2xl p-5 text-white shadow-cel-sm transition duration-200 hover:-translate-y-1 hover:shadow-cel-lg"
                style={{ background: `linear-gradient(135deg, ${mood.from}, ${mood.to})` }}
              >
                <span aria-hidden="true" className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 transition duration-300 group-hover:scale-150" />
                <span className="relative block font-display text-xl">{mood.label}</span>
                <span className="relative block text-sm text-white/85">{mood.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="genres-title" className="mt-16">
        <h2 id="genres-title" className="mb-5 font-display text-2xl sm:text-3xl">
          {h.genresTitle}
        </h2>
        <ul className="flex flex-wrap gap-3">
          {GENRES.map((genre) => (
            <li key={genre}>
              <Link
                href={`/anime?genre=${encodeURIComponent(genre)}`}
                className="block rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-semibold transition hover:bg-fg/5"
              >
                {c.catalog.genres[genre] ?? genre}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      </PageContainer>
    </>
  );
}
