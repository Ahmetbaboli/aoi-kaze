import type { Metadata } from 'next';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { getContent } from '@/content';
import { getAdminOverview, listAdminActions, listReportQueue, searchUsers, type UserReportReason } from '@/lib/admin/moderation-core';
import { requireAdmin } from '@/lib/auth-guards';
import { db } from '@/lib/db';
import { getLeaderboard, type PuzzleData } from '@/lib/game/game-core';
import { dayKey, seasonKey } from '@/lib/game/game-logic';
import type { Locale } from '@/lib/i18n';
import { cn, fmt } from '@/lib/utils';
import PageContainer from '@/components/layout/PageContainer';
import Card from '@/components/ui/Card';
import Link from '@/components/ui/LocLink';
import SectionHeading from '@/components/ui/SectionHeading';
import ModerationControls, { CloseReportsButtons } from '@/components/admin/ModerationControls';

const TABS = ['overview', 'reports', 'users', 'game', 'sources', 'log'] as const;
type Tab = (typeof TABS)[number];

interface AdminPageProps {
  params: { locale: Locale };
  searchParams: { tab?: string; q?: string };
}

export function generateMetadata({ params }: AdminPageProps): Metadata {
  return { title: getContent(params.locale).admin.title, robots: { index: false, follow: false } };
}

export const dynamic = 'force-dynamic';

type Labels = ReturnType<typeof getContent>['admin'];

function Avatar({ src, name }: { src: string | null; name: string | null }) {
  return (
    <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary">
      {src ? (
        <Image src={src} alt="" fill sizes="40px" unoptimized className="object-cover" />
      ) : (
        <span aria-hidden="true" className="flex h-full w-full items-center justify-center font-bold text-white">
          {(name ?? '?')[0]?.toUpperCase()}
        </span>
      )}
    </span>
  );
}

function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'danger' | 'volt' }) {
  const tones = { muted: 'bg-fg/10 text-fg', danger: 'bg-primary text-white', volt: 'bg-volt text-ink' };
  return <span className={cn('rounded-md px-2 py-0.5 text-xs font-bold', tones[tone])}>{children}</span>;
}

export default async function AdminPage({ params, searchParams }: AdminPageProps) {
  const { locale } = params;
  // Rol her istekte veritabanından okunur. Yönetici değilse 404 (sayfanın varlığı belli edilmez).
  const me = await requireAdmin({ locale, callbackUrl: `/${locale}/admin`, mode: 'page' });
  const c = getContent(locale);
  const a = c.admin;
  const tab: Tab = (TABS as readonly string[]).includes(searchParams.tab ?? '') ? (searchParams.tab as Tab) : 'overview';
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-US';
  const fmtDate = (d: Date) => new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  const now = new Date();
  const season = seasonKey(now);
  const overview = await getAdminOverview(db, now);

  return (
    <PageContainer className="max-w-5xl">
      <SectionHeading title={a.title} subtitle={a.subtitle} />

      <nav aria-label={a.title} className="mb-8 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const count = t === 'reports' ? overview.openUserReports : t === 'sources' ? overview.flaggedSources : 0;
          return (
            <Link
              key={t}
              href={t === 'overview' ? '/admin' : `/admin?tab=${t}`}
              aria-current={tab === t ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-lg border px-4 py-2 text-sm font-semibold transition',
                tab === t ? 'border-transparent bg-primary text-white' : 'border-line bg-surface hover:bg-fg/5',
              )}
            >
              {a.nav[t]}
              {count > 0 && <span className="ml-2 rounded-full bg-volt px-1.5 text-xs text-ink">{count}</span>}
            </Link>
          );
        })}
      </nav>

      {tab === 'overview' && <Overview stats={overview} a={a} locale={dateLocale} />}
      {tab === 'reports' && <Reports a={a} reasonLabels={c.report.reasons} season={season} fmtDate={fmtDate} />}
      {tab === 'users' && <Users a={a} season={season} fmtDate={fmtDate} query={searchParams.q ?? ''} meId={me.id} />}
      {tab === 'game' && <Game a={a} now={now} season={season} />}
      {tab === 'sources' && <Sources a={a} />}
      {tab === 'log' && <Log a={a} fmtDate={fmtDate} />}
    </PageContainer>
  );
}

/* ------------------------------ Sekmeler ------------------------------ */

function Overview({ stats, a, locale }: { stats: Awaited<ReturnType<typeof getAdminOverview>>; a: Labels; locale: string }) {
  const tiles: [keyof Labels['stats'], number, string?][] = [
    ['users', stats.users],
    ['newUsers', stats.newUsers],
    ['banned', stats.banned],
    ['openUserReports', stats.openUserReports, '/admin?tab=reports'],
    ['flaggedSources', stats.flaggedSources, '/admin?tab=sources'],
    ['playsToday', stats.playsToday, '/admin?tab=game'],
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map(([key, value, href]) => {
        const body = (
          <Card innerClassName="p-5">
            <p className="text-sm font-semibold text-muted">{a.stats[key]}</p>
            <p className="mt-1 font-display text-3xl">{value.toLocaleString(locale)}</p>
          </Card>
        );
        return <li key={key}>{href ? <Link href={href} className="block transition-transform hover:-translate-y-0.5">{body}</Link> : body}</li>;
      })}
    </ul>
  );
}

async function Reports({ a, reasonLabels, season, fmtDate }: { a: Labels; reasonLabels: Record<UserReportReason, string>; season: string; fmtDate: (d: Date) => string }) {
  const queue = await listReportQueue(db);
  if (queue.length === 0) return <p className="text-muted">{a.reports.empty}</p>;
  return (
    <ul className="space-y-4">
      {queue.map((item) => (
        <li key={item.user.id}>
          <Card innerClassName="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar src={item.user.avatar} name={item.user.username} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {item.user.name || `@${item.user.username}`}{' '}
                  <span className="font-normal text-muted">@{item.user.username}</span>
                </p>
                <p className="text-xs text-muted">{fmt(a.reports.first, { date: fmtDate(item.firstAt) })}</p>
              </div>
              <Badge tone="danger">{fmt(a.reports.count, { n: item.count })}</Badge>
              {item.user.bannedAt && <Badge>{a.users.bannedBadge}</Badge>}
              {!item.user.profilePublic && <Badge>{a.users.privateBadge}</Badge>}
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(item.reasons).map(([reason, n]) => (
                <Badge key={reason} tone="volt">
                  {reasonLabels[reason as UserReportReason] ?? reason} × {n}
                </Badge>
              ))}
            </div>

            <p className="rounded-lg bg-fg/5 p-3 text-sm whitespace-pre-line">{item.user.bio || <span className="text-muted">{a.reports.noBio}</span>}</p>

            {item.notes.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-semibold">{a.reports.notes}</p>
                <ul className="space-y-1 text-sm text-muted">
                  {item.notes.map((n, i) => (
                    <li key={i}>
                      <span className="font-semibold text-fg">{reasonLabels[n.reason as UserReportReason] ?? n.reason}:</span> {n.note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {item.user.role === 'ADMIN' ? (
              <p className="text-sm text-muted">{a.users.adminNote}</p>
            ) : (
              <ModerationControls user={item.user} season={season} hasOpenReports content={a} />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <CloseReportsButtons userId={item.user.id} content={a} />
              {item.user.username && item.user.profilePublic && !item.user.bannedAt && (
                <Link href={`/u/${item.user.username}`} className="text-sm font-semibold text-primary-text hover:underline">
                  {a.reports.viewProfile} →
                </Link>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

async function Users({ a, season, fmtDate, query, meId }: { a: Labels; season: string; fmtDate: (d: Date) => string; query: string; meId: string }) {
  const users = await searchUsers(db, query);
  return (
    <div className="space-y-6">
      <form method="get" className="flex gap-2" role="search">
        <input type="hidden" name="tab" value="users" />
        <label htmlFor="admin-q" className="sr-only">
          {a.users.search}
        </label>
        <input id="admin-q" name="q" defaultValue={query} placeholder={a.users.placeholder} className="field flex-1" />
        <button type="submit" className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white">
          {a.users.submit}
        </button>
      </form>

      {users.length === 0 ? (
        <p className="text-muted">{a.users.empty}</p>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => (
            <li key={u.id}>
              <Card innerClassName="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar src={u.avatar} name={u.username ?? u.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">
                      {u.username ? (
                        <Link href={`/u/${u.username}`} className="hover:underline">
                          @{u.username}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}{' '}
                      {u.name && <span className="font-normal text-muted">{u.name}</span>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {u.email} · {fmt(a.users.joined, { date: fmtDate(u.createdAt) })}
                    </p>
                  </div>
                  {u.role === 'ADMIN' && <Badge tone="volt">{a.users.adminBadge}</Badge>}
                  {u.bannedAt && <Badge tone="danger">{a.users.bannedBadge}</Badge>}
                  {!u.profilePublic && <Badge>{a.users.privateBadge}</Badge>}
                  {u.openReports > 0 && <Badge tone="danger">{fmt(a.users.openReports, { n: u.openReports })}</Badge>}
                </div>
                {u.bannedAt && u.banReason && <p className="text-sm text-muted">⛔ {u.banReason}</p>}
                {u.role === 'ADMIN' || u.id === meId ? (
                  <p className="text-sm text-muted">{a.users.adminNote}</p>
                ) : (
                  <ModerationControls user={u} season={season} hasOpenReports={u.openReports > 0} content={a} />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Game({ a, now, season }: { a: Labels; now: Date; season: string }) {
  const day = dayKey(now);
  const [puzzle, top, seasons] = await Promise.all([
    db.gamePuzzle.findUnique({ where: { day } }),
    getLeaderboard(db, season, 10),
    db.gameSeason.findMany({ orderBy: { id: 'desc' }, take: 10 }),
  ]);
  const [plays, solved] = puzzle
    ? await Promise.all([db.gamePlay.count({ where: { puzzleId: puzzle.id } }), db.gamePlay.count({ where: { puzzleId: puzzle.id, solved: true } })])
    : [0, 0];
  const answer = puzzle ? (puzzle.data as unknown as PuzzleData).answer : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card innerClassName="space-y-3 p-5">
        <h2 className="font-display text-xl">
          {a.game.today} <span className="text-sm font-normal text-muted">{day}</span>
        </h2>
        {puzzle && answer ? (
          <>
            <p className="text-sm text-muted">{fmt(a.game.plays, { n: plays, solved })}</p>
            <details className="rounded-lg bg-fg/5 p-3">
              <summary className="cursor-pointer text-sm font-semibold">{a.game.reveal}</summary>
              <Link href={`/anime/${answer.id}`} className="mt-2 block font-bold hover:underline">
                {answer.title}
                {answer.titleNative && <span className="ml-2 font-normal text-muted">{answer.titleNative}</span>}
              </Link>
            </details>
          </>
        ) : (
          <p className="text-sm text-muted">{a.game.noPuzzle}</p>
        )}
      </Card>

      <Card innerClassName="space-y-3 p-5">
        <h2 className="font-display text-xl">
          {a.game.top} <span className="text-sm font-normal text-muted">{season}</span>
        </h2>
        {top.length === 0 ? (
          <p className="text-sm text-muted">{a.game.none}</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {top.map((row) => (
              <li key={row.userId} className="flex justify-between gap-3">
                <span className="truncate">
                  {row.rank}. {row.username ? `@${row.username}` : '—'}
                </span>
                <span className="font-semibold tabular-nums">{row.score}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card className="lg:col-span-2" innerClassName="space-y-3 p-5">
        <h2 className="font-display text-xl">{a.game.seasons}</h2>
        {seasons.length === 0 ? (
          <p className="text-sm text-muted">{a.game.none}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {seasons.map((s) => (
              <li key={s.id}>
                <Badge>{s.id}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function Sources({ a }: { a: Labels }) {
  const rows = await db.episodeSource.findMany({
    where: { needsReview: true },
    include: { provider: { select: { name: true } }, episode: { select: { number: true, anime: { select: { title: true } } } } },
    orderBy: { brokenReports: 'desc' },
    take: 100,
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{a.sources.text}</p>
      {rows.length === 0 ? (
        <p className="text-muted">{a.sources.empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Card innerClassName="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {row.episode.anime.title} · #{row.episode.number}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {row.provider.name} · {row.type}
                    {row.quality ? ` · ${row.quality}` : ''} · <span className="break-all">{row.url}</span>
                  </p>
                </div>
                <Badge tone="danger">{fmt(a.sources.reports, { n: row.brokenReports })}</Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Log({ a, fmtDate }: { a: Labels; fmtDate: (d: Date) => string }) {
  const actions = await listAdminActions(db, 50);
  if (actions.length === 0) return <p className="text-muted">{a.log.empty}</p>;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {actions.map((row) => {
        const details = (row.details ?? {}) as Record<string, unknown>;
        const extra = typeof details.reason === 'string' ? details.reason : typeof details.to === 'string' ? `${details.from ?? '—'} → ${details.to}` : null;
        return (
          <li key={row.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-4 text-sm">
            <span className="font-semibold">{a.log.labels[row.action] ?? row.action}</span>
            <span className="text-muted">{fmt(a.log.by, { actor: row.actor ? `@${row.actor}` : '—', target: row.target ? `@${row.target}` : '—' })}</span>
            {extra && <span className="text-muted">· {extra}</span>}
            <time className="ml-auto text-xs text-muted" dateTime={row.createdAt.toISOString()}>
              {fmtDate(row.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
