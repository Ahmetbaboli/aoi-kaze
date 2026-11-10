// Profil okuma/yazma çekirdeği. İçe aktarmalar yalnızca tür ve .ts uzantılıdır: `scripts/test-profile.mjs`
// bu dosyayı Node'un TypeScript desteğiyle doğrudan çalıştırıp PGlite üzerinde test eder.
import type { PrismaClient } from '@prisma/client';
import { checkUsername, containsProfanity } from './moderation.ts';
import { computeStats, type ProfileStats, type StatEntry, type StatKind, type StatStatus } from './stats.ts';

export const BIO_MAX = 200;
/** Kullanıcı adı en fazla bu sıklıkla değiştirilebilir (taklit ve karışıklığı önlemek için). */
export const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const statusMap: Record<string, StatStatus> = { PLANNING: 'planned', WATCHING: 'current', PAUSED: 'current', COMPLETED: 'completed', DROPPED: 'dropped' };

export interface ProfileListItem {
  id: number;
  kind: StatKind;
  title: string;
  cover: string | null;
  color: string | null;
  status: StatStatus;
  favorite: boolean;
  progress: number;
  updatedAt: Date;
}

/** Kullanıcının liste girdileri (istatistik ve vitrin için), en son güncellenen başta. */
export async function getListItems(db: PrismaClient, userId: string) {
  const rows = await db.listEntry.findMany({
    where: { userId, anime: { anilistId: { not: null } } },
    include: { anime: { select: { anilistId: true, kind: true, title: true, coverUrl: true, color: true, totalUnits: true, genres: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  });
  return rows.map((row) => ({
    item: {
      id: row.anime.anilistId!,
      kind: row.anime.kind.toLowerCase() as StatKind,
      title: row.anime.title,
      cover: row.anime.coverUrl,
      color: row.anime.color,
      status: row.status ? statusMap[row.status] : null,
      favorite: row.favorite,
      progress: row.progress,
      updatedAt: row.updatedAt,
    } satisfies ProfileListItem,
    stat: {
      kind: row.anime.kind.toLowerCase() as StatKind,
      status: row.status ? statusMap[row.status] : null,
      favorite: row.favorite,
      progress: row.progress,
      total: row.anime.totalUnits,
      genres: row.anime.genres,
    } satisfies StatEntry,
  }));
}

export interface PublicProfile {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  avatar: string | null;
  banner: string | null;
  profilePublic: boolean;
  role: 'USER' | 'ADMIN';
  joinedAt: Date;
  /** Takılı oyun kozmetikleri */
  equippedFrame: string | null;
  equippedName: string | null;
  equippedTitle: string | null;
  stats: ProfileStats;
  favorites: ProfileListItem[];
  recent: ProfileListItem[];
}

/** Profil sayfası verisi. Kullanıcı adı büyük/küçük harf duyarsızdır. Gizlilik kararı çağırana aittir. */
export async function getProfile(db: PrismaClient, username: string): Promise<PublicProfile | null> {
  if (!/^[a-z0-9_]{1,20}$/i.test(username)) return null;
  const user = await db.user.findUnique({ where: { username: username.toLowerCase() } });
  // Yasaklı kullanıcının profili yokmuş gibi davranılır (404).
  if (!user || !user.username || user.bannedAt) return null;
  const list = await getListItems(db, user.id);
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    bio: user.bio,
    avatar: user.avatarUrl ?? user.image,
    banner: user.bannerUrl,
    profilePublic: user.profilePublic,
    role: user.role,
    equippedFrame: user.equippedFrame,
    equippedName: user.equippedName,
    equippedTitle: user.equippedTitle,
    joinedAt: user.createdAt,
    stats: computeStats(list.map((l) => l.stat)),
    favorites: list.filter((l) => l.item.favorite).slice(0, 12).map((l) => l.item),
    recent: list.slice(0, 6).map((l) => l.item),
  };
}

/* ------------------------------ Kaydetme ------------------------------ */

/** Avatar: 'keep' değiştirme · 'provider' giriş sağlayıcısının (GitHub) avatarı · sayı: o eserin kapağı. */
export type AvatarChoice = 'keep' | 'provider' | number;
/** Banner: 'keep' değiştirme · 'none' kaldır · sayı: o eserin banner'ı (yoksa kapağı). */
export type BannerChoice = 'keep' | 'none' | number;

export interface ProfileInput {
  username: unknown;
  bio: unknown;
  profilePublic: unknown;
  avatar: unknown;
  banner: unknown;
}

export type ProfileField = 'username' | 'bio' | 'avatar' | 'banner';
export type ProfileError =
  | 'username_format'
  | 'username_reserved'
  | 'username_profanity'
  | 'username_taken'
  | 'username_cooldown'
  | 'bio_too_long'
  | 'bio_profanity'
  | 'image_invalid'
  | 'image_unavailable';

export type SaveResult =
  | { ok: true; username: string }
  | { ok: false; errors: Partial<Record<ProfileField, ProfileError>>; retryAt?: number; form?: 'rate_limited' | 'unauthorized' };

/** Eser kimliğinden +18 olmayan görselleri getirir (AniList); eser yoksa/+18 ise null, servis yoksa 'unavailable'. */
export type MediaLookup = (id: number) => Promise<{ cover: string | null; banner: string | null } | null | 'unavailable'>;

/** Yalnızca AniList CDN görselleri saklanır (next/image ve CSP için bilinen tek kaynak). */
const isAnilistImage = (url: string | null | undefined): url is string =>
  !!url && /^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/[\w/.-]+\.(jpe?g|png|webp)$/i.test(url);

/** Kontrol karakterlerini atar; satır sonlarını korur ama en fazla iki boş satıra izin verir. */
const cleanBio = (bio: string) =>
  bio
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const parseChoice = <T extends string>(value: unknown, keywords: readonly T[]): T | number | null =>
  typeof value === 'string' && (keywords as readonly string[]).includes(value)
    ? (value as T)
    : Number.isSafeInteger(value) && (value as number) > 0
      ? (value as number)
      : null;

/**
 * Profili doğrular ve kaydeder (Server Action'ın çekirdeği; testler doğrudan bunu çağırır).
 *  - kullanıcı adı: biçim, ayrılmış ad, küfür, benzersizlik, 30 günde bir değişiklik
 *  - biyografi: en fazla 200 karakter, küfür filtresi
 *  - avatar/banner: yalnızca eser kimliği kabul edilir; görsel adresi sunucuda AniList'ten (+18 hariç) alınır
 */
export async function saveProfile(db: PrismaClient, userId: string | null | undefined, input: ProfileInput, lookup: MediaLookup, now: Date = new Date()): Promise<SaveResult> {
  if (!userId) return { ok: false, errors: {}, form: 'unauthorized' };
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, errors: {}, form: 'unauthorized' };

  const errors: Partial<Record<ProfileField, ProfileError>> = {};
  let retryAt: number | undefined;

  // Kullanıcı adı
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  const changingName = username !== user.username;
  if (changingName) {
    const problem = checkUsername(username);
    if (problem) errors.username = `username_${problem}`;
    else if (user.usernameChangedAt && now.getTime() - user.usernameChangedAt.getTime() < USERNAME_COOLDOWN_MS) {
      errors.username = 'username_cooldown';
      retryAt = user.usernameChangedAt.getTime() + USERNAME_COOLDOWN_MS;
    } else if (await db.user.findFirst({ where: { username, NOT: { id: userId } }, select: { id: true } })) {
      errors.username = 'username_taken';
    }
  }

  // Biyografi
  const bio = typeof input.bio === 'string' ? cleanBio(input.bio) : '';
  if (bio.length > BIO_MAX) errors.bio = 'bio_too_long';
  else if (containsProfanity(bio)) errors.bio = 'bio_profanity';

  // Avatar ve banner
  const avatar = parseChoice(input.avatar, ['keep', 'provider'] as const);
  const banner = parseChoice(input.banner, ['keep', 'none'] as const);
  let avatarUrl: string | null | undefined; // undefined = dokunma
  let bannerUrl: string | null | undefined;

  if (avatar === null) errors.avatar = 'image_invalid';
  else if (avatar === 'provider') avatarUrl = null;
  else if (typeof avatar === 'number') {
    const media = await lookup(avatar);
    if (media === 'unavailable') errors.avatar = 'image_unavailable';
    else if (!media || !isAnilistImage(media.cover)) errors.avatar = 'image_invalid';
    else avatarUrl = media.cover;
  }

  if (banner === null) errors.banner = 'image_invalid';
  else if (banner === 'none') bannerUrl = null;
  else if (typeof banner === 'number') {
    const media = await lookup(banner);
    const url = media && media !== 'unavailable' ? (isAnilistImage(media.banner) ? media.banner : media.cover) : null;
    if (media === 'unavailable') errors.banner = 'image_unavailable';
    else if (!isAnilistImage(url)) errors.banner = 'image_invalid';
    else bannerUrl = url;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, ...(retryAt ? { retryAt } : {}) };

  try {
    const saved = await db.user.update({
      where: { id: userId },
      data: {
        ...(changingName ? { username, usernameChangedAt: now } : {}),
        bio: bio || null,
        profilePublic: input.profilePublic === true,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(bannerUrl !== undefined ? { bannerUrl } : {}),
      },
      select: { username: true },
    });
    return { ok: true, username: saved.username! };
  } catch (error) {
    // Aynı anda iki kişi aynı adı seçtiyse benzersizlik kısıtı yakalar.
    if ((error as { code?: string })?.code === 'P2002') return { ok: false, errors: { username: 'username_taken' } };
    throw error;
  }
}
