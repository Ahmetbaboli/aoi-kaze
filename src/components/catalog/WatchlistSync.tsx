'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { setSyncUser } from '@/lib/watchlist';

/** Oturum durumunu Listem deposuna bildirir: giriş varsa liste hesapla senkronlanır. Görünür bir şey çizmez. */
export default function WatchlistSync() {
  const { data, status } = useSession();
  const userId = data?.user?.id ?? null;

  useEffect(() => {
    if (status === 'loading') return;
    setSyncUser(status === 'authenticated' ? userId : null);
  }, [status, userId]);

  return null;
}
