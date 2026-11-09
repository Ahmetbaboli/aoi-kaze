import 'server-only';
import type { ValidationResult } from './types.ts';
import { getProvider } from './registry.ts';
import { fail, validateLocalPath } from './util.ts';

/**
 * Kaynak adresi doğrulaması: admin paneli, seed ve okuma katmanı AYNI kuralları kullanır.
 * Bilinmeyen sağlayıcı anahtarı geçersiz sayılır (hata fırlatılmaz).
 */
export function validateSourceInput(providerKey: string, url: string): ValidationResult {
  const provider = getProvider(providerKey);
  if (!provider) return fail('unknown_provider');
  return provider.validateInput(url);
}

/** Altyazı adresi: local sağlayıcısıyla aynı kurallar, yalnızca .vtt. */
export function validateSubtitleUrl(url: string): ValidationResult {
  return validateLocalPath(url, ['.vtt']);
}
