// Günlük Tahmin veritabanı çekirdeği. İçe aktarmalar yalnızca tür ve .ts uzantılıdır: `scripts/test-game.mjs`
// bu dosyayı Node'un TypeScript desteğiyle doğrudan çalıştırıp PGlite üzerinde test eder.
//
// Hile koruması:
//  - Cevap ve henüz açılmamış ipuçları istemciye HİÇ gönderilmez; her tahmin sunucuda doğrulanır.
//  - Puan sunucuda hesaplanır; istemciden puan alınmaz. Kullanıcı başına günde tek oyun.
//  - Günün animesi gizli bir anahtarla (AUTH_SECRET) karıştırılarak seçilir: kaynak koddan tahmin edilemez.
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import {
  CLUE_ORDER,
  MAX_GUESSES,
  REWARD_SLOT,
  REWARD_TOP,
  dayKey,
  isRewardItem,
  previousDay,
  revealedClueCount,
  rewardsForRank,
  scoreFor,
  seasonKey,
  type ClueKey,
  type RewardItem,
  type RewardSlot,
} from './game-logic.ts';

export interface PuzzleClues {
  basics: { format: string | null; year: number | null; episodes: number | null };
  genres: string[];
  studio: string | null;
  tags: string[];
  cover: string | null;
  character: string | null;
}

export interface PuzzleData {
  answer: { id: number; title: string; titleNative: string | null; cover: string | null; color: string | null };
  clues: PuzzleClues;
}

/** Aday eser kaynağı (AniList): popülerlik sırasıyla 1-tabanlı sayfa; her sayfa en fazla 50 eser. */
export type CandidateSource = (page: number) => Promise<PuzzleData[]>;

/** Aday havuzu: en popüler 500 anime (10 sayfa). Herkesin bilebileceği kadar tanınmış olsun. */
export const POOL_PAGES = 10;
/** Aynı anime en az bu kadar gün tekrar sorulmaz. */
export const NO_REPEAT_DAYS = 365;

export type GameError = 'unauthorized' | 'unavailable' | 'invalid' | 'finished' | 'duplicate' | 'conflict';

/** İstemciye giden durum: yalnızca açılmış ipuçları; cevap yalnızca oyun bitince. */
export interface PublicPlayState {
  day: string;
  season: string;
  guesses: { id: number; correct: boolean }[];
  clues: Partial<PuzzleClues>;
  revealed: ClueKey[];
  finished: boolean;
  solved: boolean;
  score: number;
  streak: number;
  answer: PuzzleData['answer'] | null;
}

/* ------------------------------ Bulmaca seçimi ------------------------------ */

/** Gizli anahtar + günden deterministik sayı (aynı gün herkese aynı bulmaca). */
export function seededNumber(secret: string, day: string, salt = ''): number {
  return createHash('sha256').update(`${secret}:${day}:${salt}`).digest().readUInt32BE(0);
}

/** Günün bulmacasını getirir; yoksa oluşturur (aynı anda gelen iki istek tek bulmaca üretir). */
export async function getOrCreatePuzzle(db: PrismaClient, day: string, source: CandidateSource, secret: string) {
  const existing = await db.gamePuzzle.findUnique({ where: { day } });
  if (existing) return existing;

  const recent = await db.gamePuzzle.findMany({ select: { mediaId: true }, orderBy: { day: 'desc' }, take: NO_REPEAT_DAYS });
  const used = new Set(recent.map((p) => p.mediaId));
  const startPage = (seededNumber(secret, day, 'page') % POOL_PAGES) + 1;

  let chosen: PuzzleData | null = null;
  for (let step = 0; step < POOL_PAGES && !chosen; step++) {
    const page = ((startPage - 1 + step) % POOL_PAGES) + 1;
    const candidates = (await source(page)).filter((c) => !used.has(c.answer.id) && c.clues.genres.length > 0);
    if (candidates.length === 0) continue;
    chosen = candidates[seededNumber(secret, day, `pick:${page}`) % candidates.length];
  }
  if (!chosen) throw new Error('game: aday bulunamadı');

  try {
    return await db.gamePuzzle.create({ data: { day, mediaId: chosen.answer.id, data: chosen as object } });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2002') return db.gamePuzzle.findUniqueOrThrow({ where: { day } });
    throw error;
  }
}

function publicState(
  puzzle: { day: string; mediaId: number; data: unknown },
  play: { guesses: number[]; finished: boolean; solved: boolean; score: number; streak: number } | null,
  season: string,
): PublicPlayState {
  const data = puzzle.data as PuzzleData;
  const guesses = play?.guesses ?? [];
  const finished = play?.finished ?? false;
  const wrong = guesses.filter((g) => g !== puzzle.mediaId).length;
  const revealed = CLUE_ORDER.slice(0, revealedClueCount(wrong, finished));
  const clues: Partial<PuzzleClues> = {};
  for (const key of revealed) (clues as Record<string, unknown>)[key] = data.clues[key];
  return {
    day: puzzle.day,
    season,
    guesses: guesses.map((id) => ({ id, correct: id === puzzle.mediaId })),
    clues,
    revealed,
    finished,
    solved: play?.solved ?? false,
    score: play?.score ?? 0,
    streak: play?.streak ?? 0,
    answer: finished ? data.answer : null,
  };
}

/** Kullanıcının bugünkü oyun durumu (girişsizse yalnızca ilk ipucu gösterilir; oynamak için giriş gerekir). */
export async function getPlayState(db: PrismaClient, userId: string | null | undefined, now: Date, source: CandidateSource, secret: string): Promise<PublicPlayState> {
  const day = dayKey(now);
  const puzzle = await getOrCreatePuzzle(db, day, source, secret);
  const play = userId ? await db.gamePlay.findUnique({ where: { userId_puzzleId: { userId, puzzleId: puzzle.id } } }) : null;
  return publicState(puzzle, play, seasonKey(now));
}

/** Tahmin gönderir. Doğruysa puan ve seri hesaplanır; 6. yanlışta oyun biter (0 puan). */
export async function submitGuess(
  db: PrismaClient,
  userId: string | null | undefined,
  mediaId: unknown,
  now: Date,
  source: CandidateSource,
  secret: string,
): Promise<{ ok: true; state: PublicPlayState } | { ok: false; error: GameError }> {
  if (!userId) return { ok: false, error: 'unauthorized' };
  if (!Number.isSafeInteger(mediaId) || (mediaId as number) <= 0) return { ok: false, error: 'invalid' };
  const guess = mediaId as number;
  const day = dayKey(now);
  const season = seasonKey(now);
  const puzzle = await getOrCreatePuzzle(db, day, source, secret);
  const key = { userId_puzzleId: { userId, puzzleId: puzzle.id } };

  await db.gamePlay.upsert({ where: key, create: { userId, puzzleId: puzzle.id, day, season }, update: {} });
  const play = await db.gamePlay.findUniqueOrThrow({ where: key });
  if (play.finished) return { ok: false, error: 'finished' };
  if (play.guesses.includes(guess)) return { ok: false, error: 'duplicate' };

  const guesses = [...play.guesses, guess];
  const correct = guess === puzzle.mediaId;
  const finished = correct || guesses.length >= MAX_GUESSES;
  let streak = 0;
  let score = 0;
  if (correct) {
    const yesterday = await db.gamePlay.findFirst({ where: { userId, day: previousDay(day), solved: true }, select: { streak: true } });
    streak = (yesterday?.streak ?? 0) + 1;
    score = scoreFor(guesses.length, streak);
  }

  // İyimser kilit: aynı anda iki tahmin gelirse yalnızca biri yazılır (tahmin listesi değişmediyse güncelle).
  const updated = await db.gamePlay.updateMany({
    where: { userId, puzzleId: puzzle.id, finished: false, guesses: { equals: play.guesses } },
    data: { guesses, solved: correct, finished, score, streak, ...(finished ? { finishedAt: now } : {}) },
  });
  if (updated.count === 0) return { ok: false, error: 'conflict' };

  const fresh = await db.gamePlay.findUniqueOrThrow({ where: key });
  return { ok: true, state: publicState(puzzle, fresh, season) };
}

/* ------------------------------ Sezon sıralaması ve ödüller ------------------------------ */

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string | null;
  /** Gizli profilli oyuncular adıyla gösterilmez */
  hidden: boolean;
  avatar: string | null;
  equippedFrame: string | null;
  equippedName: string | null;
  equippedTitle: string | null;
  score: number;
  solved: number;
  played: number;
}

/** Sezon sıralaması: toplam puan, eşitlikte çözülen gün sayısı, sonra daha az oyunla aynı puan. */
export async function getLeaderboard(db: PrismaClient, season: string, limit = REWARD_TOP): Promise<LeaderboardRow[]> {
  const groups = await db.gamePlay.groupBy({
    by: ['userId'],
    where: { season, finished: true },
    _sum: { score: true },
    _count: { _all: true },
  });
  const solvedGroups = await db.gamePlay.groupBy({ by: ['userId'], where: { season, solved: true }, _count: { _all: true } });
  const solvedBy = new Map(solvedGroups.map((g) => [g.userId, g._count._all]));
  const users = await db.user.findMany({
    where: { id: { in: groups.map((g) => g.userId) } },
    select: { id: true, username: true, profilePublic: true, avatarUrl: true, image: true, equippedFrame: true, equippedName: true, equippedTitle: true, bannedAt: true },
  });
  const userBy = new Map(users.map((u) => [u.id, u]));

  return groups
    .map((g) => ({ userId: g.userId, score: g._sum.score ?? 0, solved: solvedBy.get(g.userId) ?? 0, played: g._count._all }))
    .filter((row) => row.score > 0 && userBy.has(row.userId) && !userBy.get(row.userId)!.bannedAt)
    .sort((a, b) => b.score - a.score || b.solved - a.solved || a.played - b.played || a.userId.localeCompare(b.userId))
    .slice(0, limit)
    .map((row, index) => {
      const u = userBy.get(row.userId);
      const hidden = !u?.profilePublic;
      return {
        ...row,
        rank: index + 1,
        username: hidden ? null : (u?.username ?? null),
        hidden,
        avatar: hidden ? null : (u?.avatarUrl ?? u?.image ?? null),
        equippedFrame: u?.equippedFrame ?? null,
        equippedName: u?.equippedName ?? null,
        equippedTitle: u?.equippedTitle ?? null,
      };
    });
}

/** Kullanıcının sezondaki sırası (ilk 50 dışında da), puanı yoksa null. */
export async function getUserRank(db: PrismaClient, season: string, userId: string): Promise<{ rank: number; score: number } | null> {
  const all = await getLeaderboard(db, season, 100_000);
  const row = all.find((r) => r.userId === userId);
  return row ? { rank: row.rank, score: row.score } : null;
}

/**
 * Bitmiş ve henüz ödüllendirilmemiş sezonları ödüllendirir (sayfa açılışında tembel çalışır; idempotent).
 * Sezon kaydı ödüllerle aynı işlemde oluşturulur: iki istek aynı anda gelse de ödül bir kez verilir.
 */
export async function awardPendingSeasons(db: PrismaClient, now: Date): Promise<string[]> {
  const current = seasonKey(now);
  const seasons = await db.gamePlay.findMany({ where: { season: { lt: current } }, distinct: ['season'], select: { season: true } });
  const done = new Set((await db.gameSeason.findMany({ where: { id: { in: seasons.map((s) => s.season) } } })).map((s) => s.id));
  const awarded: string[] = [];

  for (const { season } of seasons) {
    if (done.has(season)) continue;
    const top = await getLeaderboard(db, season, REWARD_TOP);
    try {
      await db.$transaction(async (tx) => {
        await tx.gameSeason.create({ data: { id: season } });
        const rows = top.flatMap((row) => rewardsForRank(row.rank).map((item) => ({ userId: row.userId, season, rank: row.rank, item })));
        if (rows.length > 0) await tx.gameReward.createMany({ data: rows, skipDuplicates: true });
      });
      awarded.push(season);
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2002') throw error; // başka istek az önce ödüllendirdi
    }
  }
  return awarded;
}

/** Kullanıcının sahip olduğu ödüller (aynı eşyanın en iyi sırası ve kazanıldığı sezonlar). */
export async function getRewards(db: PrismaClient, userId: string) {
  const rewards = await db.gameReward.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const owned = new Map<RewardItem, { item: RewardItem; seasons: string[]; bestRank: number }>();
  for (const r of rewards) {
    if (!isRewardItem(r.item)) continue;
    const prev = owned.get(r.item);
    owned.set(r.item, { item: r.item, seasons: [...(prev?.seasons ?? []), r.season], bestRank: Math.min(prev?.bestRank ?? Infinity, r.rank) });
  }
  return [...owned.values()];
}

/** Kozmetik takma/çıkarma: yalnızca sahip olunan ve o yuvaya ait eşya takılabilir; null → çıkar. */
export async function equipItem(db: PrismaClient, userId: string | null | undefined, slot: unknown, item: unknown): Promise<{ ok: true } | { ok: false; error: GameError }> {
  if (!userId) return { ok: false, error: 'unauthorized' };
  if (slot !== 'frame' && slot !== 'name' && slot !== 'title') return { ok: false, error: 'invalid' };
  const field = ({ frame: 'equippedFrame', name: 'equippedName', title: 'equippedTitle' } as const)[slot as RewardSlot];
  if (item === null) {
    await db.user.update({ where: { id: userId }, data: { [field]: null } });
    return { ok: true };
  }
  if (!isRewardItem(item) || REWARD_SLOT[item] !== slot) return { ok: false, error: 'invalid' };
  const owns = await db.gameReward.findFirst({ where: { userId, item }, select: { id: true } });
  if (!owns) return { ok: false, error: 'invalid' };
  await db.user.update({ where: { id: userId }, data: { [field]: item } });
  return { ok: true };
}
