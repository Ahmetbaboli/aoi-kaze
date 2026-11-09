import 'server-only';
import type { EpisodeSourceRow, PlayableSource, SourceProvider, ValidationResult } from '../types.ts';
import { fail, ok } from '../util.ts';

/**
 * İzinli ana makineler. Yalnızca doğrulanmış Blender dosya sunucusu: alt alan adı gerekirse, doğrulandıktan sonra
 * buraya TEK TEK eklenir (joker kullanılmaz). CSP'deki media-src ile aynı liste kullanılmalıdır.
 */
export const BLENDER_HOSTS: ReadonlySet<string> = new Set(['download.blender.org']);

/**
 * https zorunlu; yalnızca .mp4 ve .m3u8; kimlik bilgisi, port ve yüzde kodlu gezinme (%2e, %2f, %5c) reddedilir.
 * Normalize edilen adres fragmentsiz tam URL'dir.
 */
function validateInput(raw: string): ValidationResult {
  if (typeof raw !== 'string') return fail('invalid_input');
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return fail('not_a_url');
  }
  if (url.protocol !== 'https:') return fail('https_required');
  if (url.username || url.password) return fail('credentials_not_allowed');
  if (url.port) return fail('port_not_allowed');
  if (!BLENDER_HOSTS.has(url.hostname.toLowerCase())) return fail('host_not_allowed');
  if (/%2e|%2f|%5c/i.test(url.pathname)) return fail('encoded_traversal');
  if (!/\.(mp4|m3u8)$/i.test(url.pathname)) return fail('extension_not_allowed');
  return ok(`https://${url.hostname.toLowerCase()}${url.pathname}${url.search}`);
}

function toPlayable(source: EpisodeSourceRow): PlayableSource | null {
  const result = validateInput(source.url);
  if (!result.ok) return null;
  const hls = /\.m3u8$/i.test(new URL(result.normalized).pathname);
  return {
    sourceId: source.id,
    providerKey: 'blender-cdn',
    kind: hls ? 'hls' : 'mp4',
    src: result.normalized,
    audio: source.type,
    quality: source.quality ?? (hls ? 'auto' : null),
    translatorGroup: source.translatorGroup,
    subtitles: [],
    attribution: null,
  };
}

export const blenderCdnProvider: SourceProvider = { key: 'blender-cdn', validateInput, toPlayable };
