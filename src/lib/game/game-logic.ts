// Günlük Tahmin oyununun saf kuralları (içe aktarma yok): hem sunucu hem istemci kullanır,
// `scripts/test-game.mjs` doğrudan çalıştırır.
//
// Oyun: her gün herkes için aynı anime. Oyuncu 6 tahmin hakkıyla animeyi bulmaya çalışır; her yanlış
// tahminde bir sonraki ipucu açılır. Ne kadar az ipucuyla bilirsen o kadar puan. Art arda çözülen günler
// seri bonusu getirir. Puanlar haftalık sezonda toplanır; sezon sonunda ilk 50'ye kozmetik ödül verilir.

/** Gün ve sezon sınırları Türkiye saatine göre (UTC+3, yaz saati yok). */
export const GAME_UTC_OFFSET_HOURS = 3;
export const MAX_GUESSES = 6;

/** İpuçlarının açılma sırası: başta 1. ipucu açık, her yanlış tahminde bir sonraki. */
export const CLUE_ORDER = ['basics', 'genres', 'studio', 'tags', 'cover', 'character'] as const;
export type ClueKey = (typeof CLUE_ORDER)[number];

/** Kaçıncı tahminde bilindiyse taban puan (1. tahmin 100 … 6. tahmin 15). */
export const BASE_POINTS = [100, 80, 60, 45, 30, 15] as const;
/** Seri bonusu: ikinci günden itibaren her ardışık gün +5, en fazla +50. */
export const STREAK_BONUS = 5;
export const STREAK_BONUS_MAX_DAYS = 10;

export function scoreFor(attempt: number, streak: number): number {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > MAX_GUESSES) return 0;
  const bonus = STREAK_BONUS * Math.min(Math.max(0, streak - 1), STREAK_BONUS_MAX_DAYS);
  return BASE_POINTS[attempt - 1] + bonus;
}

/** Açık ipucu sayısı: oyun bitmediyse yanlış tahmin sayısı + 1; bittiyse hepsi. */
export const revealedClueCount = (wrongGuesses: number, finished: boolean) =>
  finished ? CLUE_ORDER.length : Math.min(CLUE_ORDER.length, Math.max(0, wrongGuesses) + 1);

const shift = (date: Date) => new Date(date.getTime() + GAME_UTC_OFFSET_HOURS * 3600_000);
const pad = (n: number) => String(n).padStart(2, '0');

/** Bulmaca günü, Türkiye saatiyle "YYYY-MM-DD". */
export function dayKey(date: Date): string {
  const d = shift(date);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Bir önceki gün ("2026-11-01" → "2026-10-31"). */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d - 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** ISO hafta numarasıyla sezon anahtarı, "2026-W46" (hafta pazartesi başlar). Sözlük sırası = zaman sırası. */
export function seasonKey(date: Date): string {
  const d = shift(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const weekday = (target.getUTCDay() + 6) % 7; // pazartesi 0
  target.setUTCDate(target.getUTCDate() - weekday + 3); // haftanın perşembesi ISO yılını belirler
  const isoYear = target.getUTCFullYear();
  const dayOfYear = Math.round((target.getTime() - Date.UTC(isoYear, 0, 1)) / 86_400_000);
  const week = 1 + Math.floor(dayOfYear / 7);
  return `${isoYear}-W${pad(week)}`;
}

/** Bir sonraki bulmacanın başlayacağı an (Türkiye saatiyle gece yarısı). */
export function nextPuzzleAt(date: Date): Date {
  const d = shift(date);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return new Date(midnight - GAME_UTC_OFFSET_HOURS * 3600_000);
}

/** Sezonun bitişi (bir sonraki pazartesi gece yarısı, Türkiye saati). */
export function seasonEndsAt(date: Date): Date {
  const d = shift(date);
  const weekday = (d.getUTCDay() + 6) % 7;
  const nextMonday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (7 - weekday));
  return new Date(nextMonday - GAME_UTC_OFFSET_HOURS * 3600_000);
}

/* ------------------------------ Ödüller (yalnızca kozmetik) ------------------------------ */

export const REWARD_TOP = 50;
export type RewardItem = 'frame_gold' | 'frame_silver' | 'frame_bronze' | 'name_gradient' | 'name_color' | 'title_champion';
export type RewardSlot = 'frame' | 'name' | 'title';

export const REWARD_SLOT: Record<RewardItem, RewardSlot> = {
  frame_gold: 'frame',
  frame_silver: 'frame',
  frame_bronze: 'frame',
  name_gradient: 'name',
  name_color: 'name',
  title_champion: 'title',
};

/** Sezon sıralamasına göre kazanılan ödüller: ilk 3 altın, 4–10 gümüş, 11–50 bronz. */
export function rewardsForRank(rank: number): RewardItem[] {
  if (!Number.isInteger(rank) || rank < 1 || rank > REWARD_TOP) return [];
  if (rank <= 3) return ['frame_gold', 'name_gradient', 'title_champion'];
  if (rank <= 10) return ['frame_silver', 'name_color'];
  return ['frame_bronze'];
}

export const isRewardItem = (value: unknown): value is RewardItem => typeof value === 'string' && value in REWARD_SLOT;

/* ------------------------------ Paylaşım ------------------------------ */

/** Sonucu ipucu vermeden paylaşmak için kısa metin: "Aoi Kaze Günlük Tahmin 2026-11-09 · 3/6 🟥🟥🟩". */
export function shareText(label: string, day: string, guesses: number, solved: boolean): string {
  const squares = Array.from({ length: guesses }, (_, i) => (solved && i === guesses - 1 ? '🟩' : '🟥')).join('');
  return `${label} ${day} · ${solved ? guesses : 'X'}/${MAX_GUESSES} ${squares}`;
}
