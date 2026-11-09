'use server';

import 'server-only';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { applyListOps, type SyncResult } from './watchlist-sync.ts';

/**
 * Listem senkronu (Server Action). Arka planda çağrıldığı için girişsiz çağrı yönlendirmez, 'unauthorized' döner.
 * İşlemleri uygular ve kullanıcının güncel listesini döndürür; boş işlem listesi yalnızca listeyi okur.
 */
export async function syncWatchlist(ops: unknown): Promise<SyncResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'unauthorized' };
  // Kullanıcı başına dakikada 60 istek: istemci değişiklikleri zaten toplu gönderir.
  if (!rateLimit(`watchlist:${userId}`, 60, 60_000)) return { ok: false, error: 'rate_limited' };
  try {
    return await applyListOps(db, userId, ops);
  } catch (error) {
    console.error('[watchlist] senkron başarısız', error);
    throw new Error('sync_failed');
  }
}
