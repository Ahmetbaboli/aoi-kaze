import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getContent } from '@/content';
import { db } from '@/lib/db';
import type { Locale } from '@/lib/i18n';
import { getProfile, type ProfileListItem } from '@/lib/profile/profile-core';
import { cn, fmt } from '@/lib/utils';
import CoverArt from '@/components/catalog/CoverArt';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { StyledName, TitleBadge } from '@/components/game/Cosmetics';
import ReportButton from '@/components/profile/ReportButton';

const FRAME_CLASS: Record<string, string> = { frame_gold: 'frame-gold', frame_silver: 'frame-silver', frame_bronze: 'frame-bronze' };
import Link from '@/components/ui/LocLink';

interface ProfilePageProps {
  params: { locale: Locale; username: string };
}

// Oturuma ve canlı liste verisine bağlı: her istekte render edilir.
export const dynamic = 'force-dynamic';

const BADGE_ICONS: Record<string, string> = {
  first_step: '🌱',
  episodes_100: '🏃',
  episodes_1000: '🔥',
  chapters_500: '📚',
  completed_10: '✅',
  completed_50: '🗄️',
  collector: '💖',
  manhwa_fan: '📱',
  explorer: '🧭',
  genre_master: '🎯',
  all_rounder: '🌈',
};

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const p = getContent(params.locale).profile;
  const profile = await getProfile(db, params.username);
  // Gizli profiller ve olmayan kullanıcılar arama motorlarına kapalı.
  if (!profile || !profile.profilePublic) return { title: p.private.title, robots: { index: false, follow: false } };
  return {
    title: `@${profile.username} ${p.titleSuffix}`,
    description: profile.bio ?? undefined,
    robots: { index: false, follow: true },
  };
}

function formatMinutes(minutes: number, labels: { days: string; hours: string }) {
  const hours = Math.round(minutes / 60);
  return hours >= 48 ? fmt(labels.days, { n: (hours / 24).toFixed(1) }) : fmt(labels.hours, { n: hours });
}

function MiniCover({ item }: { item: ProfileListItem }) {
  return (
    <Link href={`/${item.kind}/${item.id}`} className="group block" title={item.title}>
      <Card className="transition-transform group-hover:-translate-y-1">
        <div className="relative aspect-[2/3] bg-night">
          <CoverArt media={item} sizes="(min-width: 1024px) 10vw, 30vw" />
        </div>
      </Card>
      <p className="mt-2 line-clamp-2 text-sm font-bold leading-tight">{item.title}</p>
    </Link>
  );
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = params;
  const [profile, session] = await Promise.all([getProfile(db, params.username), auth()]);
  if (!profile) notFound();

  const c = getContent(locale);
  const p = c.profile;
  const isOwner = session?.user?.id === profile.id;

  if (!profile.profilePublic && !isOwner) {
    return (
      <PageContainer className="max-w-2xl">
        <Card innerClassName="p-8 text-center">
          <p aria-hidden="true" className="text-4xl">🔒</p>
          <h1 className="mt-4 font-display text-2xl">{p.private.title}</h1>
          <p className="mt-2 text-muted">{p.private.text}</p>
        </Card>
      </PageContainer>
    );
  }

  const { stats } = profile;
  const level = stats.level;
  // Banner yoksa favori ya da son eklenen eserin renginden bir geçiş.
  const accent = profile.favorites[0]?.color ?? profile.recent[0]?.color ?? '#e11d48';
  const maxGenre = stats.genres[0]?.count ?? 1;
  const earned = stats.badges.filter((b) => b.earned).length;
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-US';
  const joined = new Intl.DateTimeFormat(dateLocale, { month: 'long', year: 'numeric' }).format(profile.joinedAt);

  const tiles: [string, string][] = [
    [p.stats.episodes, stats.episodes.toLocaleString(dateLocale)],
    [p.stats.chapters, stats.chapters.toLocaleString(dateLocale)],
    [p.stats.time, formatMinutes(stats.minutes, p.stats)],
    [p.stats.completed, String(stats.byStatus.completed)],
    [p.stats.entries, String(stats.entries)],
    [p.stats.favorites, String(stats.favorites)],
  ];

  return (
    <div>
      {/* Banner */}
      <div className="relative h-44 w-full overflow-hidden bg-night sm:h-64">
        {profile.banner ? (
          <Image src={profile.banner} alt="" fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${accent} 0%, #0A0A10 90%)` }} />
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
      </div>

      <PageContainer className="-mt-16 max-w-5xl py-0 sm:-mt-20">
        {/* Başlık */}
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end">
          {/* Takılı oyun çerçevesi varsa avatarın etrafında görünür. */}
          <span className={cn('inline-block w-fit shrink-0 rounded-full', profile.equippedFrame ? FRAME_CLASS[profile.equippedFrame] : 'border-4 border-bg shadow-cel')}>
            <span className="relative block h-28 w-28 overflow-hidden rounded-full bg-primary sm:h-36 sm:w-36">
              {profile.avatar ? (
                <Image src={profile.avatar} alt="" fill sizes="144px" unoptimized className="object-cover" />
              ) : (
                <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-4xl font-bold text-white">
                  {profile.username[0]?.toUpperCase()}
                </span>
              )}
            </span>
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-3xl tracking-tight">
                <StyledName nameStyle={profile.equippedName}>{profile.name || `@${profile.username}`}</StyledName>
              </h1>
              {profile.role === 'ADMIN' && <span className="rounded-md bg-volt px-2 py-0.5 text-xs font-bold text-ink">{p.adminBadge}</span>}
              {profile.equippedTitle === 'title_champion' && <TitleBadge label={c.game.rewards.items.title_champion} />}
            </div>
            <p className="text-muted">
              @{profile.username} · {fmt(p.joined, { date: joined })}
            </p>
          </div>
          {isOwner ? (
            <Button href="/hesap" variant="secondary" className="self-start sm:self-end">
              {p.edit}
            </Button>
          ) : (
            profile.role !== 'ADMIN' && (
              <div className="self-start sm:self-end">
                <ReportButton
                  username={profile.username}
                  signedIn={!!session?.user}
                  loginHref={`/giris?callbackUrl=${encodeURIComponent(`/${locale}/u/${profile.username}`)}`}
                  content={c.report}
                />
              </div>
            )
          )}
        </div>

        {isOwner && !profile.profilePublic && <p className="mt-6 rounded-lg bg-volt p-3 text-sm font-semibold text-ink">{p.privateOwner}</p>}
        {profile.bio && <p className="mt-6 max-w-2xl whitespace-pre-line text-lg">{profile.bio}</p>}

        {/* Seviye */}
        <Card className="mt-8" innerClassName="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <div
            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full text-white"
            style={{ background: `conic-gradient(rgb(var(--primary)) ${level.ratio * 360}deg, rgb(127 127 127 / 0.25) 0deg)` }}
          >
            <div className="flex h-[5.2rem] w-[5.2rem] flex-col items-center justify-center rounded-full bg-night">
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider opacity-80">{p.level}</span>
              <span className="font-display text-3xl leading-none">{level.level}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl">{p.titles[level.title]}</p>
            <p className="text-sm font-semibold text-muted">{fmt(p.xp, { xp: level.xp.toLocaleString(dateLocale) })}</p>
            <div
              className="mt-3 h-3 overflow-hidden rounded-full bg-fg/10"
              role="progressbar"
              aria-label={p.level}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(level.ratio * 100)}
            >
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.max(2, level.ratio * 100)}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">{level.next === null ? p.maxLevel : fmt(p.toNext, { n: (level.next - level.xp).toLocaleString(dateLocale) })}</p>
            <p className="mt-3 text-xs text-muted">{p.levelNote}</p>
          </div>
        </Card>

        {/* İstatistikler */}
        <section aria-labelledby="stats-title" className="mt-10">
          <h2 id="stats-title" className="mb-4 font-display text-xl">
            {p.stats.title}
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-surface p-4">
                <dt className="text-xs font-semibold text-muted">{label}</dt>
                <dd className="mt-1 font-display text-2xl tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          {/* Türler */}
          <section aria-labelledby="genres-title">
            <h2 id="genres-title" className="mb-4 font-display text-xl">
              {p.genresTitle}
            </h2>
            {stats.genres.length === 0 ? (
              <p className="text-muted">{p.genresEmpty}</p>
            ) : (
              <ul className="space-y-2.5">
                {stats.genres.map((genre) => (
                  <li key={genre.name} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
                    <span className="truncate font-semibold">{genre.name}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-fg/10" aria-hidden="true">
                      <span className="block h-full rounded-full bg-electric" style={{ width: `${(genre.count / maxGenre) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-muted">{genre.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Rozetler */}
          <section aria-labelledby="badges-title">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id="badges-title" className="font-display text-xl">
                {p.badgesTitle}
              </h2>
              <span className="text-sm font-semibold text-muted">{fmt(p.badgesEarned, { n: earned, total: stats.badges.length })}</span>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.badges.map((badge) => {
                const text = p.badges[badge.id];
                return (
                  <li
                    key={badge.id}
                    title={text.hint}
                    className={cn('rounded-xl border p-3', badge.earned ? 'border-primary/40 bg-primary/10' : 'border-line bg-surface opacity-70')}
                  >
                    <span aria-hidden="true" className={cn('text-2xl', !badge.earned && 'grayscale')}>
                      {BADGE_ICONS[badge.id]}
                    </span>
                    <p className="mt-1 text-sm font-bold leading-tight">{text.name}</p>
                    <p className="text-xs text-muted">{badge.earned ? text.hint : `${badge.value} / ${badge.target}`}</p>
                    <span className="sr-only">{badge.earned ? '✓' : text.hint}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Favoriler */}
        <section aria-labelledby="fav-title" className="mt-12">
          <h2 id="fav-title" className="mb-4 font-display text-xl">
            {p.favoritesTitle}
          </h2>
          {profile.favorites.length === 0 ? (
            <p className="text-muted">{p.empty}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {profile.favorites.map((item) => (
                <li key={item.id}>
                  <MiniCover item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Son hareketler */}
        <section aria-labelledby="recent-title" className="mb-16 mt-12">
          <h2 id="recent-title" className="mb-4 font-display text-xl">
            {p.recentTitle}
          </h2>
          {profile.recent.length === 0 ? (
            <p className="text-muted">{p.empty}</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
              {profile.recent.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color ?? 'currentColor' }} />
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="text-muted">{p.statusVerb[item.status ?? 'fav']} </span>
                    <Link href={`/${item.kind}/${item.id}`} className="font-semibold hover:underline">
                      {item.title}
                    </Link>
                  </p>
                  <time dateTime={item.updatedAt.toISOString()} className="shrink-0 text-xs text-muted">
                    {new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short' }).format(item.updatedAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </PageContainer>
    </div>
  );
}
