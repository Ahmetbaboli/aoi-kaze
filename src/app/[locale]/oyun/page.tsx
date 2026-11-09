import type { Metadata } from 'next';
import { auth } from '@/auth';
import { getContent } from '@/content';
import { getMediaImages } from '@/lib/catalog';
import { db } from '@/lib/db';
import { awardPendingSeasons, getLeaderboard, getPlayState, getRewards, getUserRank, type PublicPlayState } from '@/lib/game/game-core';
import { nextPuzzleAt, seasonEndsAt } from '@/lib/game/game-logic';
import { candidateSource, gameSecret } from '@/lib/game/server';
import { localePath, type Locale } from '@/lib/i18n';
import { alternatesFor } from '@/lib/seo';
import { cn, fmt } from '@/lib/utils';
import { FramedAvatar, StyledName, TitleBadge } from '@/components/game/Cosmetics';
import GameBoard from '@/components/game/GameBoard';
import RewardsPanel from '@/components/game/RewardsPanel';
import PageContainer from '@/components/layout/PageContainer';
import SectionHeading from '@/components/ui/SectionHeading';
import Link from '@/components/ui/LocLink';

interface GamePageProps {
  params: { locale: Locale };
}

// Oturuma ve güne bağlı: her istekte render edilir.
export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: GamePageProps): Metadata {
  const g = getContent(params.locale).game;
  return { title: g.title, description: g.subtitle, alternates: alternatesFor('/oyun', params.locale) };
}

/** "2 gün 4 sa" / "5 sa 12 dk" */
function untilLabel(ms: number, locale: Locale) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const u = locale === 'tr' ? { d: 'gün', h: 'sa', m: 'dk' } : { d: 'd', h: 'h', m: 'm' };
  return d > 0 ? `${d} ${u.d} ${h} ${u.h}` : `${h} ${u.h} ${m} ${u.m}`;
}

export default async function GamePage({ params }: GamePageProps) {
  const { locale } = params;
  const c = getContent(locale);
  const g = c.game;
  const now = new Date();
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Biten sezonların ödülleri tembel dağıtılır (idempotent).
  await awardPendingSeasons(db, now).catch((error) => console.error('[oyun] sezon ödülleri dağıtılamadı', error));

  let state: PublicPlayState | null = null;
  try {
    state = await getPlayState(db, userId, now, candidateSource, gameSecret());
  } catch (error) {
    console.error('[oyun] bulmaca hazırlanamadı', error);
  }

  const season = state?.season ?? '';
  const [board, myRank, rewards, me] = await Promise.all([
    state ? getLeaderboard(db, season) : Promise.resolve([]),
    state && userId ? getUserRank(db, season, userId) : Promise.resolve(null),
    userId ? getRewards(db, userId) : Promise.resolve([]),
    userId ? db.user.findUnique({ where: { id: userId }, select: { equippedFrame: true, equippedName: true, equippedTitle: true } }) : Promise.resolve(null),
  ]);

  // Önceki tahminlerin adları (yalnızca kullanıcının kendi tahminleri; cevap sızmaz).
  const guessIds = state?.guesses.map((x) => x.id) ?? [];
  const guessTitles = guessIds.length ? ((await getMediaImages(guessIds)) ?? []) : [];
  const titles = Object.fromEntries(guessTitles.map((m) => [m.id, m.title]));

  return (
    <PageContainer>
      <SectionHeading title={`🎮 ${g.title}`} subtitle={g.subtitle} />

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0">
          {state ? (
            <GameBoard
              state={state}
              signedIn={!!userId}
              loginHref={`/giris?callbackUrl=${encodeURIComponent(localePath(locale, '/oyun'))}`}
              content={g}
              formats={c.catalog.formats}
              genres={c.catalog.genres}
              titles={titles}
              nextAt={nextPuzzleAt(now).getTime()}
            />
          ) : (
            <p className="rounded-xl bg-volt p-4 font-semibold text-ink">{g.unavailable}</p>
          )}
        </div>

        <aside className="space-y-8">
          <section aria-labelledby="scoring-title" className="rounded-xl border border-line bg-surface p-5">
            <h2 id="scoring-title" className="mb-2 font-display text-lg">
              {g.scoring.title}
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {g.scoring.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="rewards-title" className="rounded-xl border border-line bg-surface p-5">
            <h2 id="rewards-title" className="mb-2 font-display text-lg">
              {g.rewards.title}
            </h2>
            <p className="text-sm text-muted">{g.rewards.text}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {g.rewards.tiers.map((tier, i) => (
                <li key={tier.range} className="flex gap-2">
                  <span aria-hidden="true">{['🥇', '🥈', '🥉'][i]}</span>
                  <span>
                    <strong>{tier.range}</strong> {tier.items}
                  </span>
                </li>
              ))}
            </ul>
            {userId && (
              <div className="mt-5">
                <h3 className="mb-2 text-sm font-bold">{g.rewards.mine}</h3>
                <RewardsPanel
                  owned={rewards.map(({ item, bestRank }) => ({ item, bestRank }))}
                  equipped={{ frame: me?.equippedFrame ?? null, name: me?.equippedName ?? null, title: me?.equippedTitle ?? null }}
                  content={g.rewards}
                />
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Sıralama */}
      {state && (
        <section aria-labelledby="board-title" className="mt-14">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="board-title" className="font-display text-2xl">
                🏆 {g.board.title}
              </h2>
              <p className="text-sm text-muted">{fmt(g.board.season, { season, time: untilLabel(seasonEndsAt(now).getTime() - now.getTime(), locale) })}</p>
            </div>
            {userId && <p className="text-sm font-semibold">{myRank ? fmt(g.board.you, { rank: myRank.rank, score: myRank.score }) : g.board.notRanked}</p>}
          </div>
          {board.length === 0 ? (
            <p className="text-muted">{g.board.empty}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[28rem] text-sm">
                <thead className="bg-fg/5 text-left text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th scope="col" className="w-14 px-4 py-2">
                      {g.board.rank}
                    </th>
                    <th scope="col" className="px-4 py-2">
                      {g.board.player}
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      {g.board.solved}
                    </th>
                    <th scope="col" className="px-4 py-2 text-right">
                      {g.board.score}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {board.map((row) => (
                    <tr key={row.userId} className={cn(row.userId === userId && 'bg-primary/10')}>
                      <td className="px-4 py-2.5 font-bold tabular-nums">{row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2.5">
                          <FramedAvatar src={row.avatar} fallback={row.username ?? '?'} frame={row.hidden ? null : row.equippedFrame} size={28} />
                          {row.hidden || !row.username ? (
                            <span className="italic text-muted">{g.board.hidden}</span>
                          ) : (
                            <Link href={`/u/${row.username}`} className="font-semibold hover:underline">
                              <StyledName nameStyle={row.equippedName}>@{row.username}</StyledName>
                            </Link>
                          )}
                          {!row.hidden && row.equippedTitle === 'title_champion' && <TitleBadge label={g.rewards.items.title_champion} />}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.solved}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{row.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </PageContainer>
  );
}
