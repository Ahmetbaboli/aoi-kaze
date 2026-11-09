import 'server-only';
import { fetchGameCandidates } from '@/lib/catalog/anilist';
import type { CandidateSource } from './game-core.ts';

/** Gerçek aday kaynağı: AniList (ANILIST_ENABLED=false ise oyun da kapalıdır). */
export const candidateSource: CandidateSource = async (page) => {
  if (process.env.ANILIST_ENABLED === 'false') throw new Error('AniList kapalı');
  return fetchGameCandidates(page);
};

/**
 * Günün animesini karıştıran gizli anahtar. AUTH_SECRET'tan türetilir: kaynak kod açık olsa da
 * yarının cevabı hesaplanamaz. Geliştirmede anahtar yoksa sabit bir değer kullanılır.
 */
export const gameSecret = () => `game:${process.env.AUTH_SECRET ?? 'dev-only-secret'}`;
