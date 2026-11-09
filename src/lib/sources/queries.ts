import 'server-only';
import { db } from '@/lib/db';
import { loadEpisodeSources, type LoadOptions } from './core.ts';

/**
 * Bir bölümün oynatılabilir kaynakları (doğrulanmış, lisanslı, sıralı). Kaynak yoksa boş dizi.
 * Sunucu bileşenlerinde ve Server Action'larda kullan; oynatıcı arayüzü (Aşama 2) bu listeyi tüketecek.
 */
export const getEpisodeSources = (episodeId: string, options: LoadOptions = {}) => loadEpisodeSources(db, episodeId, options);

export { validateSourceInput, validateSubtitleUrl } from './validate.ts';
export type { PlayableSource, PlayableKind, SubtitleTrack } from './types.ts';
