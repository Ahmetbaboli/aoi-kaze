'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { equipItem, submitGuess, type GameError, type PublicPlayState } from './game-core.ts';
import { candidateSource, gameSecret } from './server.ts';

/** Tahmin gönder (Server Action). Giriş zorunlu; dakikada 30 tahmin sınırı (zaten günde en fazla 6 geçerli tahmin var). */
export async function guessAction(mediaId: number): Promise<{ ok: true; state: PublicPlayState } | { ok: false; error: GameError | 'rate_limited' }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'unauthorized' };
  if (!rateLimit(`game:${userId}`, 30, 60_000)) return { ok: false, error: 'rate_limited' };
  try {
    const result = await submitGuess(db, userId, mediaId, new Date(), candidateSource, gameSecret());
    if (result.ok && result.state.finished) revalidatePath('/[locale]/oyun', 'page');
    return result;
  } catch (error) {
    console.error('[oyun] tahmin işlenemedi', error);
    return { ok: false, error: 'unavailable' };
  }
}

/** Kozmetik tak / çıkar (Server Action). */
export async function equipAction(slot: string, item: string | null): Promise<{ ok: boolean }> {
  const session = await auth();
  const result = await equipItem(db, session?.user?.id, slot, item);
  if (result.ok) {
    revalidatePath('/[locale]/oyun', 'page');
    revalidatePath('/[locale]/u/[username]', 'page');
  }
  return { ok: result.ok };
}
