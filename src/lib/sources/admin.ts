import 'server-only';
import { db } from '@/lib/db';
import { getProvider } from './registry.ts';
import type { PlayableKind } from './types.ts';

export interface AdminSourceRow {
  sourceId: string;
  animeTitle: string;
  episodeNumber: number;
  providerKey: string;
  providerName: string;
  licensed: boolean;
  providerEnabled: boolean;
  enabled: boolean;
  audio: 'SUB' | 'DUB';
  quality: string | null;
  brokenReports: number;
  needsReview: boolean;
  subtitleLangs: string[];
  /** Okuma katmanının bu kaynağı kabul edip etmeyeceği (doğrulama sonucu) */
  validation: { ok: true } | { ok: false; reason: string };
  /** Önizleme için güvenli bilgi; doğrulamadan geçmeyen kaynakta null */
  preview: { kind: PlayableKind; src: string } | null;
}

/**
 * Doğrulama sayfası için TÜM kaynaklar (lisanssız ve devre dışı olanlar dahil: yönetici hepsini görmeli).
 * Önizleme yalnızca doğrulamadan geçen kaynaklar için üretilir.
 */
export async function listSourcesForAdmin(): Promise<AdminSourceRow[]> {
  const rows = await db.episodeSource.findMany({
    include: {
      provider: true,
      subtitles: { select: { lang: true } },
      episode: { select: { number: true, anime: { select: { title: true } } } },
    },
    orderBy: [{ episode: { anime: { title: 'asc' } } }, { episode: { number: 'asc' } }, { createdAt: 'asc' }],
  });

  return rows.map((row) => {
    const provider = getProvider(row.provider.key);
    const validation = provider ? provider.validateInput(row.url) : ({ ok: false, reason: 'unknown_provider' } as const);
    const playable =
      provider && validation.ok
        ? provider.toPlayable({
            id: row.id,
            url: row.url,
            type: row.type,
            quality: row.quality,
            provider: { key: row.provider.key },
            translatorGroup: null,
            subtitles: [],
          })
        : null;

    return {
      sourceId: row.id,
      animeTitle: row.episode.anime.title,
      episodeNumber: row.episode.number,
      providerKey: row.provider.key,
      providerName: row.provider.name,
      licensed: row.provider.licensed,
      providerEnabled: row.provider.enabled,
      enabled: row.enabled,
      audio: row.type,
      quality: row.quality,
      brokenReports: row.brokenReports,
      needsReview: row.needsReview,
      subtitleLangs: row.subtitles.map((subtitle) => subtitle.lang).sort(),
      validation: validation.ok ? { ok: true } : { ok: false, reason: validation.reason },
      preview: playable && row.provider.licensed ? { kind: playable.kind, src: playable.src } : null,
    };
  });
}
