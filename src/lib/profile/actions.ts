'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { getMediaImages } from '@/lib/catalog';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { saveProfile as saveProfileCore, type ProfileInput, type SaveResult } from './profile-core.ts';

/** Profil kaydetme (Server Action). Girişsiz çağrı boş hata döner; dakikada 10 kayıt sınırı. */
export async function saveProfile(input: ProfileInput): Promise<SaveResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, errors: {}, form: 'unauthorized' };
  if (!rateLimit(`profile:${userId}`, 10, 60_000)) return { ok: false, errors: {}, form: 'rate_limited' };

  const result = await saveProfileCore(db, userId, input, async (id) => {
    const images = await getMediaImages([id]);
    if (images === null) return 'unavailable';
    const media = images.find((m) => m.id === id);
    return media ? { cover: media.cover, banner: media.banner } : null;
  });

  if (result.ok) {
    // Eski ve yeni profil adresleri ile menüdeki avatar yenilensin.
    revalidatePath('/[locale]/u/[username]', 'page');
    revalidatePath('/[locale]/hesap', 'page');
  }
  return result;
}
