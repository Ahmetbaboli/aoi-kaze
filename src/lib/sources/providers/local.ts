import 'server-only';
import type { EpisodeSourceRow, PlayableSource, SourceProvider, ValidationResult } from '../types.ts';
import { validateLocalPath } from '../util.ts';

/** Yalnızca "/media/" ile başlayan site içi yollar; .m3u8 ya da .mp4. Kurallar için bkz. validateLocalPath. */
function validateInput(raw: string): ValidationResult {
  return validateLocalPath(raw, ['.m3u8', '.mp4']);
}

function toPlayable(source: EpisodeSourceRow): PlayableSource | null {
  const result = validateInput(source.url);
  if (!result.ok) return null;
  const hls = result.normalized.toLowerCase().endsWith('.m3u8');
  return {
    sourceId: source.id,
    providerKey: 'local',
    kind: hls ? 'hls' : 'mp4',
    src: result.normalized,
    audio: source.type,
    quality: source.quality ?? (hls ? 'auto' : null),
    translatorGroup: source.translatorGroup,
    subtitles: [],
    attribution: null,
  };
}

export const localProvider: SourceProvider = { key: 'local', validateInput, toPlayable };
