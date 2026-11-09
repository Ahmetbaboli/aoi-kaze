import 'server-only';
import type { SourceProvider } from './types.ts';
import { blenderCdnProvider } from './providers/blender-cdn.ts';
import { localProvider } from './providers/local.ts';
import { youtubeProvider } from './providers/youtube.ts';

/** providerKey → sağlayıcı. Yeni bir sağlayıcı eklemek için dosyasını yazıp buraya kaydet (ve ProviderConfig satırı ekle). */
const providers = new Map<string, SourceProvider>([
  [youtubeProvider.key, youtubeProvider],
  [blenderCdnProvider.key, blenderCdnProvider],
  [localProvider.key, localProvider],
]);

export const getProvider = (key: string): SourceProvider | undefined => providers.get(key);

export const providerKeys = (): string[] => Array.from(providers.keys());

/** Aynı kaynak türleri arasında tercih sırası: yerel dosya > Blender CDN > YouTube. Bilinmeyenler sona. */
const PROVIDER_RANK: Record<string, number> = { local: 0, 'blender-cdn': 1, youtube: 2 };
export const providerRank = (key: string): number => PROVIDER_RANK[key] ?? 9;
