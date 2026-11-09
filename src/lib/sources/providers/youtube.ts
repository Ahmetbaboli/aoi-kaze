import 'server-only';
import type { EpisodeSourceRow, PlayableSource, SourceProvider, ValidationResult } from '../types.ts';
import { fail, ok } from '../util.ts';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

/**
 * Kabul edilenler: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID ve çıplak 11 karakterli kimlik.
 * Hepsi video kimliğine normalize edilir; gömme her zaman youtube-nocookie.com üzerinden yapılır.
 * Reddedilenler: http, kimlik bilgisi/port içeren adresler, shorts, yalnızca oynatma listesi, canlı yayın,
 * başka alan adları (youtube.com.evil.com dahil) ve "embed/videoseries" (oynatma listesi gömmesi).
 */
function validateInput(raw: string): ValidationResult {
  if (typeof raw !== 'string') return fail('invalid_input');
  const input = raw.trim();
  if (VIDEO_ID.test(input)) return ok(input);

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return fail('not_a_url');
  }
  if (url.protocol !== 'https:') return fail('https_required');
  if (url.username || url.password) return fail('credentials_not_allowed');
  if (url.port) return fail('port_not_allowed');

  const host = url.hostname.toLowerCase();
  let id: string | null = null;

  if (host === 'youtu.be') {
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 1) return fail('unsupported_path');
    id = segments[0];
  } else if (WATCH_HOSTS.has(host)) {
    const path = url.pathname.replace(/\/+$/, '');
    if (path === '/watch') {
      id = url.searchParams.get('v'); // &list=… varsa yok sayılır; yalnızca video kimliği kullanılır
    } else if (/^\/embed\/[^/]+$/.test(path)) {
      id = path.split('/')[2];
    } else if (path.startsWith('/shorts/')) {
      return fail('shorts_not_supported');
    } else if (path === '/playlist') {
      return fail('playlist_not_supported');
    } else if (path.startsWith('/live/')) {
      return fail('live_not_supported');
    } else {
      return fail('unsupported_path');
    }
  } else {
    return fail('host_not_allowed');
  }

  if (!id || id === 'videoseries' || !VIDEO_ID.test(id)) return fail('invalid_video_id');
  return ok(id);
}

function toPlayable(source: EpisodeSourceRow): PlayableSource | null {
  const result = validateInput(source.url);
  if (!result.ok) return null;
  return {
    sourceId: source.id,
    providerKey: 'youtube',
    kind: 'youtube',
    src: result.normalized,
    audio: source.type,
    quality: source.quality,
    translatorGroup: source.translatorGroup,
    subtitles: [],
    attribution: null,
  };
}

export const youtubeProvider: SourceProvider = { key: 'youtube', validateInput, toPlayable };
