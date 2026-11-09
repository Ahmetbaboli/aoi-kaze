// Seviye, istatistik ve rozetler. Saf mantık (içe aktarma yok): `scripts/test-profile.mjs` doğrudan çalıştırır.
//
// Veri kaynağı Listem'dir (kullanıcının kendi beyanı). Bu yüzden seviye kişisel bir başarı göstergesidir;
// ödül verilen bir yarış için kullanılmaz. Hileyi sınırlamak için ilerleme, bilinen toplam bölüm sayısıyla
// (yoksa 5000 ile) kırpılır.

export type StatKind = 'anime' | 'manga' | 'manhwa';
export type StatStatus = 'planned' | 'current' | 'completed' | 'dropped' | null;

export interface StatEntry {
  kind: StatKind;
  status: StatStatus;
  favorite: boolean;
  progress: number;
  /** Toplam bölüm/chapter (biliniyorsa) */
  total: number | null;
  genres: string[];
}

/** XP kuralları: anime bölümü (≈24 dk) manga bölümünden (≈5 dk) daha değerli. */
export const XP = { episode: 10, chapter: 4, completed: 50 } as const;
/** Ortalama anime bölüm süresi (dk), toplam izleme süresi tahmini için. */
export const EPISODE_MINUTES = 24;
/** Toplamı bilinmeyen eserde sayılan en fazla ilerleme. */
export const PROGRESS_CAP = 5000;
export const MAX_LEVEL = 100;

/** Bir girdinin sayılan bölüm/chapter miktarı. "Tamamladım" + bilinen toplam → toplamın tamamı. */
export function unitsOf(entry: StatEntry): number {
  const cap = entry.total && entry.total > 0 ? entry.total : PROGRESS_CAP;
  const progress = Math.min(Math.max(0, Math.floor(entry.progress || 0)), cap);
  if (entry.status === 'completed' && entry.total && entry.total > 0) return entry.total;
  return progress;
}

/** Seviye L'ye ulaşmak için gereken toplam XP: 100·(L−1)². 2. seviye 100 XP (10 bölüm), 10. seviye 8100 XP. */
export const xpForLevel = (level: number) => 100 * (Math.max(1, level) - 1) ** 2;

export interface LevelInfo {
  level: number;
  xp: number;
  /** Bu seviyenin başladığı ve bir sonrakinin başlayacağı XP */
  current: number;
  next: number | null;
  /** 0–1 arası, bir sonraki seviyeye ilerleme */
  ratio: number;
  /** Unvan anahtarı (metinler içerik dosyasında) */
  title: LevelTitle;
}

export const LEVEL_TITLES = [
  { from: 1, key: 'rookie' },
  { from: 5, key: 'curious' },
  { from: 10, key: 'fan' },
  { from: 20, key: 'otaku' },
  { from: 35, key: 'master' },
  { from: 50, key: 'sensei' },
  { from: 75, key: 'legend' },
] as const;
export type LevelTitle = (typeof LEVEL_TITLES)[number]['key'];

export function levelFromXp(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  const level = Math.min(MAX_LEVEL, Math.floor(Math.sqrt(safe / 100)) + 1);
  const current = xpForLevel(level);
  const next = level >= MAX_LEVEL ? null : xpForLevel(level + 1);
  const ratio = next === null ? 1 : (safe - current) / (next - current);
  const title = [...LEVEL_TITLES].reverse().find((t) => level >= t.from)!.key;
  return { level, xp: safe, current, next, ratio: Math.min(1, Math.max(0, ratio)), title };
}

export interface ProfileStats {
  xp: number;
  level: LevelInfo;
  entries: number;
  favorites: number;
  episodes: number;
  chapters: number;
  /** Tahmini izleme süresi (dakika) */
  minutes: number;
  completed: Record<StatKind, number>;
  byStatus: Record<'planned' | 'current' | 'completed' | 'dropped', number>;
  /** En çok görülen türler (girdi sayısına göre, en fazla 8) */
  genres: { name: string; count: number }[];
  badges: BadgeState[];
}

export const BADGES = [
  { id: 'first_step', target: 1 },
  { id: 'episodes_100', target: 100 },
  { id: 'episodes_1000', target: 1000 },
  { id: 'chapters_500', target: 500 },
  { id: 'completed_10', target: 10 },
  { id: 'completed_50', target: 50 },
  { id: 'collector', target: 10 },
  { id: 'manhwa_fan', target: 5 },
  { id: 'explorer', target: 8 },
  { id: 'genre_master', target: 20 },
  { id: 'all_rounder', target: 3 },
] as const;
export type BadgeId = (typeof BADGES)[number]['id'];
export interface BadgeState {
  id: BadgeId;
  earned: boolean;
  /** Hedefe ilerleme (rozet kartında "37 / 100") */
  value: number;
  target: number;
}

export function computeStats(entries: StatEntry[]): ProfileStats {
  let episodes = 0;
  let chapters = 0;
  let favorites = 0;
  const completed: Record<StatKind, number> = { anime: 0, manga: 0, manhwa: 0 };
  const byStatus = { planned: 0, current: 0, completed: 0, dropped: 0 };
  const kinds: Record<StatKind, number> = { anime: 0, manga: 0, manhwa: 0 };
  const genreCount = new Map<string, number>();

  for (const entry of entries) {
    const units = unitsOf(entry);
    if (entry.kind === 'anime') episodes += units;
    else chapters += units;
    if (entry.favorite) favorites++;
    if (entry.status) byStatus[entry.status]++;
    if (entry.status === 'completed') completed[entry.kind]++;
    kinds[entry.kind]++;
    // Bırakılanlar ilgi alanını temsil etmez; tür dağılımına sayılmaz.
    if (entry.status !== 'dropped') for (const genre of new Set(entry.genres)) genreCount.set(genre, (genreCount.get(genre) ?? 0) + 1);
  }

  const totalCompleted = completed.anime + completed.manga + completed.manhwa;
  const xp = episodes * XP.episode + chapters * XP.chapter + totalCompleted * XP.completed;
  const genres = [...genreCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 8);
  const topGenre = genres[0]?.count ?? 0;

  const values: Record<BadgeId, number> = {
    first_step: entries.length,
    episodes_100: episodes,
    episodes_1000: episodes,
    chapters_500: chapters,
    completed_10: totalCompleted,
    completed_50: totalCompleted,
    collector: favorites,
    manhwa_fan: kinds.manhwa,
    explorer: genreCount.size,
    genre_master: topGenre,
    all_rounder: (['anime', 'manga', 'manhwa'] as const).filter((k) => completed[k] > 0).length,
  };
  const badges = BADGES.map(({ id, target }) => ({ id, target, value: Math.min(values[id], target), earned: values[id] >= target }));

  return {
    xp,
    level: levelFromXp(xp),
    entries: entries.length,
    favorites,
    episodes,
    chapters,
    minutes: episodes * EPISODE_MINUTES,
    completed,
    byStatus,
    genres,
    badges,
  };
}
