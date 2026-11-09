import 'server-only';
import type { ValidationResult } from './types.ts';

export const fail = (reason: string): ValidationResult => ({ ok: false, reason });
export const ok = (normalized: string): ValidationResult => ({ ok: true, normalized });

/** Yalnızca "/media/…" altındaki güvenli karakterler; küçük harf/büyük harf, rakam, nokta, alt çizgi, tire ve bölü. */
const SAFE_LOCAL_PATH = /^\/media\/[A-Za-z0-9._\-/]+$/;

/**
 * Site içi dosya yolu doğrulaması (local sağlayıcısı ve altyazılar için).
 * Reddedilenler: "/media/" ile başlamayan yollar, "..", "//", ters bölü, query/fragment, yüzde kodlaması
 * (örn. %2e%2e gezinmesi) ve izinli karakterlerin dışındaki her şey; ayrıca uzantı eşleşmeli.
 */
export function validateLocalPath(raw: string, extensions: readonly string[]): ValidationResult {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 300) return fail('invalid_input');
  if (!raw.startsWith('/media/')) return fail('must_start_with_media');
  if (raw.includes('\\')) return fail('backslash_not_allowed');
  if (raw.includes('//')) return fail('double_slash_not_allowed');
  if (/[?#]/.test(raw)) return fail('query_not_allowed');
  if (raw.includes('%')) return fail('encoded_characters_not_allowed');
  if (raw.split('/').some((segment) => segment === '..' || segment === '.')) return fail('path_traversal');
  if (!SAFE_LOCAL_PATH.test(raw)) return fail('invalid_characters');
  const lower = raw.toLowerCase();
  if (!extensions.some((extension) => lower.endsWith(extension))) return fail('extension_not_allowed');
  return ok(raw);
}

/** "1080p" → 1080, "4K" → 2160, "auto" (uyarlanabilir HLS) → en yüksek, bilinmeyen → 0. */
export function qualityScore(quality: string | null | undefined): number {
  if (!quality) return 0;
  const value = quality.trim().toLowerCase();
  if (value === 'auto') return 100_000;
  if (value === '8k') return 4320;
  if (value === '4k') return 2160;
  const match = value.match(/^(\d{3,4})p?$/);
  return match ? Number(match[1]) : 0;
}
