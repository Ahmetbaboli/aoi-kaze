import 'server-only';
import type { PrismaClient } from '@prisma/client';
import type { EpisodeSourceRow, PlayableSource, SubtitleTrack } from './types.ts';
import { attributionFor } from './attribution.ts';
import { getProvider, providerRank } from './registry.ts';
import { qualityScore } from './util.ts';
import { validateSubtitleUrl } from './validate.ts';

type Db = Pick<PrismaClient, 'episodeSource' | 'user'>;

export interface LoadOptions {
  /** Girişli kullanıcı: defaultAudio tercihi buradan okunur. Girişsizse SUB. */
  userId?: string;
  /** Atılan kaynakların günlüğü (varsayılan: console.warn). Testlerde yakalanır. */
  log?: (message: string) => void;
}

const defaultLog = (message: string) => console.warn(`[sources] ${message}`);

/**
 * Bir bölüm için oynatılabilir, doğrulanmış kaynak listesi.
 *
 * Derinlemesine savunma: lisans ve etkinlik filtresi veritabanı tetikleyicisine EK OLARAK burada da uygulanır;
 * ayrıca her kaynak kendi sağlayıcısının doğrulamasından yeniden geçer. Geçmeyen kaynak atılır ve günlüğe yazılır,
 * hata fırlatılmaz. Bilinmeyen sağlayıcı anahtarı da yok sayılır.
 *
 * Sıralama: 1) kullanıcının ses tercihi, 2) local > blender-cdn > youtube, 3) kalite yüksekten düşüğe.
 */
export async function loadEpisodeSources(db: Db, episodeId: string, options: LoadOptions = {}): Promise<PlayableSource[]> {
  const log = options.log ?? defaultLog;

  let preferred: 'SUB' | 'DUB' = 'SUB';
  if (options.userId) {
    const user = await db.user.findUnique({ where: { id: options.userId }, select: { defaultAudio: true } });
    if (user) preferred = user.defaultAudio;
  }

  const rows = await db.episodeSource.findMany({
    where: { episodeId, enabled: true, provider: { enabled: true, licensed: true } },
    include: {
      provider: { select: { key: true } },
      translatorGroup: { select: { name: true, slug: true } },
      subtitles: { include: { translatorGroup: { select: { name: true, slug: true } } } },
      episode: { select: { anime: { select: { slug: true, title: true } } } },
    },
  });

  const entries: { playable: PlayableSource; row: EpisodeSourceRow }[] = [];

  for (const row of rows as unknown as EpisodeSourceRow[]) {
    const provider = getProvider(row.provider.key);
    if (!provider) {
      log(`bilinmeyen sağlayıcı "${row.provider.key}", kaynak ${row.id} yok sayıldı`);
      continue;
    }

    const validation = provider.validateInput(row.url);
    if (!validation.ok) {
      log(`kaynak ${row.id} (${row.provider.key}) doğrulamadan geçemedi: ${validation.reason}`);
      continue;
    }

    const playable = provider.toPlayable(row);
    if (!playable) {
      log(`kaynak ${row.id} (${row.provider.key}) oynatılabilir hale getirilemedi`);
      continue;
    }

    playable.subtitles = validSubtitles(row, log);
    playable.attribution = attributionFor(row.episode?.anime?.slug);
    entries.push({ playable, row });
  }

  entries.sort((a, b) => {
    const audio = Number(b.playable.audio === preferred) - Number(a.playable.audio === preferred);
    if (audio !== 0) return audio;
    const rank = providerRank(a.playable.providerKey) - providerRank(b.playable.providerKey);
    if (rank !== 0) return rank;
    const quality = qualityScore(b.playable.quality) - qualityScore(a.playable.quality);
    if (quality !== 0) return quality;
    return (a.row.createdAt?.getTime() ?? 0) - (b.row.createdAt?.getTime() ?? 0) || a.row.id.localeCompare(b.row.id);
  });

  return entries.map((entry) => entry.playable);
}

/** Geçersiz biçim ya da adrese sahip altyazılar atılır; varsayılan ve dil sırasına göre döner. */
function validSubtitles(row: EpisodeSourceRow, log: (message: string) => void): SubtitleTrack[] {
  const tracks: SubtitleTrack[] = [];
  for (const subtitle of row.subtitles ?? []) {
    if (subtitle.format !== 'vtt') {
      log(`altyazı ${subtitle.id}: desteklenmeyen biçim "${subtitle.format}", atıldı`);
      continue;
    }
    const validation = validateSubtitleUrl(subtitle.url);
    if (!validation.ok) {
      log(`altyazı ${subtitle.id}: geçersiz adres (${validation.reason}), atıldı`);
      continue;
    }
    tracks.push({
      id: subtitle.id,
      lang: subtitle.lang,
      label: subtitle.label,
      url: validation.normalized,
      format: 'vtt',
      isDefault: subtitle.isDefault,
      translatorGroup: subtitle.translatorGroup,
    });
  }
  return tracks.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.lang.localeCompare(b.lang));
}
