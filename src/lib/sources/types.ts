import 'server-only';

export type PlayableKind = 'hls' | 'mp4' | 'youtube';

export interface SubtitleTrack {
  id: string;
  /** BCP-47: "tr", "en", "pt-BR" */
  lang: string;
  label: string;
  /** Doğrulanmış, site içi /media/ yolu (.vtt) */
  url: string;
  format: 'vtt';
  isDefault: boolean;
  translatorGroup: { name: string; slug: string } | null;
}

export interface PlayableSource {
  sourceId: string;
  providerKey: string;
  kind: PlayableKind;
  /** hls/mp4 için doğrulanmış URL, youtube için normalize video kimliği (11 karakter) */
  src: string;
  audio: 'SUB' | 'DUB';
  /** "1080p", "720p", "auto" (hls) */
  quality: string | null;
  translatorGroup: { name: string; slug: string } | null;
  subtitles: SubtitleTrack[];
  /** Örn. "Sintel © Blender Foundation, CC BY 3.0" */
  attribution: string | null;
}

export type ValidationResult = { ok: true; normalized: string } | { ok: false; reason: string };

export interface SubtitleRow {
  id: string;
  lang: string;
  label: string;
  url: string;
  format: string;
  isDefault: boolean;
  translatorGroup: { name: string; slug: string } | null;
}

/** Veritabanından gelen, sağlayıcıya verilen kaynak satırı (yalnızca gereken alanlar). */
export interface EpisodeSourceRow {
  id: string;
  url: string;
  type: 'SUB' | 'DUB';
  quality: string | null;
  createdAt?: Date;
  provider: { key: string };
  translatorGroup: { name: string; slug: string } | null;
  subtitles: SubtitleRow[];
  episode?: { anime?: { slug: string; title: string } | null } | null;
}

export interface SourceProvider {
  key: string;
  /** Ham URL/kimliği doğrular; geçerliyse normalize edilmiş değeri döner. */
  validateInput(url: string): ValidationResult;
  /** Oynatılabilir kaynağa çevirir; kayıt artık geçerli değilse null. Altyazı ve atıf çekirdekte doldurulur. */
  toPlayable(source: EpisodeSourceRow): PlayableSource | null;
}
