// Listem senkronunun sunucu çekirdeği. İçe aktarmalar yalnızca türdür: `scripts/test-watchlist.mjs`
// bu dosyayı Node'un TypeScript desteğiyle doğrudan çalıştırıp PGlite üzerinde test eder.
//
// Model: istemci, değişiklikleri işlem (op) olarak gönderir; sunucu "son yazan kazanır" kuralıyla
// (`updatedAt` / `at` zaman damgası) uygular ve kullanıcının güncel listesinin tamamını döndürür.
//  - put    : girdi yoksa ya da gelen daha yeniyse yazılır (eski bir cihazdaki bayat kopya yeniyi ezemez)
//  - delete : sunucudaki girdi silme anından eski ya da aynı yaşta ise silinir
// Eser satırı (Anime) ilk ihtiyaçta `anilistId` ile upsert edilir; başlık/kapak/renk önbellek olarak güncellenir.
import type { PrismaClient } from '@prisma/client';

export type SyncKind = 'anime' | 'manga' | 'manhwa';
export type SyncStatus = 'planned' | 'current' | 'completed' | 'dropped';

/** İstemcideki liste girdisiyle aynı biçim (src/lib/watchlist.ts → ListEntry). */
export interface SyncEntry {
  id: number;
  kind: SyncKind;
  title: string;
  cover: string | null;
  color: string | null;
  status: SyncStatus | null;
  favorite: boolean;
  progress?: number;
  /** Toplam bölüm/chapter (biliniyorsa); seviye hesabında "tamamladım" için */
  total?: number | null;
  /** AniList türleri; istatistik ve rozetler için */
  genres?: string[];
  updatedAt: number;
}

const cleanTotal = (value: unknown): number | null =>
  Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 100_000 ? (value as number) : null;

/** En fazla 12 tür, her biri en fazla 40 karakter; geçersizler atlanır. */
const cleanGenres = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? [...new Set(value.filter((g): g is string => typeof g === 'string').map((g) => cleanText(g, 40)).filter(Boolean))].slice(0, 12)
    : undefined;

export type SyncOp = { op: 'put'; entry: SyncEntry } | { op: 'delete'; id: number; at: number };

export type SyncError = 'unauthorized' | 'invalid' | 'too_many' | 'rate_limited' | 'list_full';
export type SyncResult = { ok: true; entries: SyncEntry[] } | { ok: false; error: SyncError };

/** Tek istekte en fazla işlem (istemci daha fazlasını parça parça gönderir). */
export const SYNC_MAX_OPS = 500;
/** Kullanıcı başına en fazla liste girdisi. */
export const LIST_MAX_ENTRIES = 5000;

const KINDS: readonly SyncKind[] = ['anime', 'manga', 'manhwa'];
const STATUSES: readonly SyncStatus[] = ['planned', 'current', 'completed', 'dropped'];

type DbKind = 'ANIME' | 'MANGA' | 'MANHWA';
type DbStatus = 'WATCHING' | 'COMPLETED' | 'PLANNING' | 'DROPPED' | 'PAUSED';

const toDbKind = (kind: SyncKind) => kind.toUpperCase() as DbKind;
const fromDbKind = (kind: DbKind) => kind.toLowerCase() as SyncKind;

const toDbStatus: Record<SyncStatus, DbStatus> = { planned: 'PLANNING', current: 'WATCHING', completed: 'COMPLETED', dropped: 'DROPPED' };
const fromDbStatus: Record<DbStatus, SyncStatus> = { PLANNING: 'planned', WATCHING: 'current', PAUSED: 'current', COMPLETED: 'completed', DROPPED: 'dropped' };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Kontrol karakterlerini atar, uzunluğu sınırlar. */
const cleanText = (value: string, max: number) => value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);

/** Yalnızca https görsel adresleri saklanır (liste kartında <img>/next/image ile çizilir). */
function cleanCover(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

const cleanColor = (value: unknown): string | null => (typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : null);

/**
 * Gelen işlemleri doğrular ve temizler. Dizi değilse `null`; geçersiz tek tek işlemler atlanır
 * (eski sürümden kalma bozuk bir yerel kayıt, istemcinin bekleyen kuyruğunu sonsuza dek kilitlemesin).
 * Gelecekteki zaman damgaları sunucu saatine çekilir (saati ileri bir cihaz sonsuza dek kazanmasın).
 */
export function parseOps(input: unknown, now: number = Date.now()): SyncOp[] | null {
  if (!Array.isArray(input)) return null;
  const ops: SyncOp[] = [];
  for (const raw of input) {
    if (!isObject(raw)) continue;
    if (raw.op === 'delete') {
      if (isId(raw.id) && isTime(raw.at)) ops.push({ op: 'delete', id: raw.id, at: Math.min(raw.at, now) });
      continue;
    }
    if (raw.op !== 'put' || !isObject(raw.entry)) continue;
    const e = raw.entry;
    if (!isId(e.id) || !KINDS.includes(e.kind as SyncKind) || typeof e.title !== 'string' || !isTime(e.updatedAt)) continue;
    if (!(e.status === null || STATUSES.includes(e.status as SyncStatus)) || typeof e.favorite !== 'boolean') continue;
    if (e.progress !== undefined && e.progress !== null && (!Number.isSafeInteger(e.progress) || (e.progress as number) < 0 || (e.progress as number) > 100_000)) continue;
    const title = cleanText(e.title, 300);
    if (!title) continue;
    ops.push({
      op: 'put',
      entry: {
        id: e.id,
        kind: e.kind as SyncKind,
        title,
        cover: cleanCover(e.cover),
        color: cleanColor(e.color),
        status: e.status as SyncStatus | null,
        favorite: e.favorite,
        progress: typeof e.progress === 'number' ? e.progress : undefined,
        total: cleanTotal(e.total),
        genres: cleanGenres(e.genres),
        updatedAt: Math.min(e.updatedAt, now),
      },
    });
  }
  return ops;
}

/** Aynı eser için birden çok işlem varsa yalnızca en yenisi kalır (sıra korunur). */
export function compactOps(ops: SyncOp[]): SyncOp[] {
  const latest = new Map<number, SyncOp>();
  const time = (op: SyncOp) => (op.op === 'put' ? op.entry.updatedAt : op.at);
  const idOf = (op: SyncOp) => (op.op === 'put' ? op.entry.id : op.id);
  for (const op of ops) {
    const previous = latest.get(idOf(op));
    if (!previous || time(op) >= time(previous)) latest.set(idOf(op), op);
  }
  return [...latest.values()];
}

/** Kullanıcının listesi, en son güncellenen başta. */
export async function getUserList(db: PrismaClient, userId: string): Promise<SyncEntry[]> {
  const rows = await db.listEntry.findMany({
    where: { userId, anime: { anilistId: { not: null } } },
    include: { anime: { select: { anilistId: true, kind: true, title: true, coverUrl: true, color: true, totalUnits: true, genres: true } } },
    orderBy: { updatedAt: 'desc' },
    take: LIST_MAX_ENTRIES,
  });
  return rows.map((row) => ({
    id: row.anime.anilistId!,
    kind: fromDbKind(row.anime.kind as DbKind),
    title: row.anime.title,
    cover: row.anime.coverUrl,
    color: row.anime.color,
    status: row.status ? fromDbStatus[row.status as DbStatus] : null,
    favorite: row.favorite,
    ...(row.progress > 0 ? { progress: row.progress } : {}),
    ...(row.anime.totalUnits ? { total: row.anime.totalUnits } : {}),
    ...(row.anime.genres.length ? { genres: row.anime.genres } : {}),
    updatedAt: row.updatedAt.getTime(),
  }));
}

/**
 * İşlemleri uygular ve güncel listeyi döndürür (Server Action'ın çekirdeği; testler doğrudan bunu çağırır).
 * Durumu da favorisi de olmayan bir "put" silme gibi davranır (istemci bu girdileri zaten tutmaz).
 */
export async function applyListOps(db: PrismaClient, userId: string | null | undefined, input: unknown, now: number = Date.now()): Promise<SyncResult> {
  if (!userId) return { ok: false, error: 'unauthorized' };
  if (Array.isArray(input) && input.length > SYNC_MAX_OPS) return { ok: false, error: 'too_many' };
  const parsed = parseOps(input, now);
  if (!parsed) return { ok: false, error: 'invalid' };
  const ops = compactOps(parsed);
  if (ops.length === 0) return { ok: true, entries: await getUserList(db, userId) };

  const ids = ops.map((op) => (op.op === 'put' ? op.entry.id : op.id));
  const existing = await db.listEntry.findMany({
    where: { userId, anime: { anilistId: { in: ids } } },
    select: { animeId: true, updatedAt: true, anime: { select: { anilistId: true } } },
  });
  const current = new Map(existing.map((row) => [row.anime.anilistId!, row]));

  const puts: SyncEntry[] = [];
  const deletes: string[] = [];
  for (const op of ops) {
    const id = op.op === 'put' ? op.entry.id : op.id;
    const row = current.get(id);
    if (op.op === 'delete' || (op.entry.status === null && !op.entry.favorite)) {
      const at = op.op === 'delete' ? op.at : op.entry.updatedAt;
      if (row && row.updatedAt.getTime() <= at) deletes.push(row.animeId);
      continue;
    }
    if (!row || row.updatedAt.getTime() < op.entry.updatedAt) puts.push(op.entry);
  }

  const newRows = puts.filter((entry) => !current.has(entry.id)).length;
  if (newRows > 0) {
    const count = await db.listEntry.count({ where: { userId } });
    if (count - deletes.length + newRows > LIST_MAX_ENTRIES) return { ok: false, error: 'list_full' };
  }

  await db.$transaction(async (tx) => {
    if (deletes.length > 0) await tx.listEntry.deleteMany({ where: { userId, animeId: { in: deletes } } });
    for (const entry of puts) {
      const cache = { title: entry.title, coverUrl: entry.cover, color: entry.color, totalUnits: entry.total ?? null, genres: entry.genres ?? [] };
      const anime = await tx.anime.upsert({
        where: { anilistId: entry.id },
        create: { anilistId: entry.id, kind: toDbKind(entry.kind), slug: `al-${entry.id}`, ...cache },
        // Önbellek alanları yalnızca boş değilse ezilir (bozuk/eksik bir istemci kapağı silmesin).
        update: {
          title: entry.title,
          ...(entry.cover ? { coverUrl: entry.cover } : {}),
          ...(entry.color ? { color: entry.color } : {}),
          ...(entry.total ? { totalUnits: entry.total } : {}),
          ...(entry.genres?.length ? { genres: entry.genres } : {}),
        },
        select: { id: true },
      });
      const data = {
        status: entry.status ? toDbStatus[entry.status] : null,
        favorite: entry.favorite,
        progress: entry.progress ?? 0,
        updatedAt: new Date(entry.updatedAt),
      };
      await tx.listEntry.upsert({
        where: { userId_animeId: { userId, animeId: anime.id } },
        create: { userId, animeId: anime.id, ...data },
        update: data,
      });
    }
  });

  return { ok: true, entries: await getUserList(db, userId) };
}
