'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { requireAdmin } from '@/lib/auth-guards';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { closeReports, moderateUser, reportUser, type ModerationError, type ReportUserError } from './moderation-core.ts';

/** Profil şikâyeti (Server Action). Arka planda çağrıldığı için girişsiz çağrı yönlendirmez, 'unauthorized' döner. */
export async function reportUserAction(username: string, reason: string, note: string): Promise<{ ok: true } | { ok: false; error: ReportUserError | 'rate_limited' }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'unauthorized' };
  if (!rateLimit(`report-user:${userId}`, 10, 60_000)) return { ok: false, error: 'rate_limited' };
  return reportUser(db, userId, { username, reason, note });
}

/** Yönetici işlemi (Server Action). Yönetici değilse ForbiddenError (403); rol her çağrıda veritabanından okunur. */
export async function moderateAction(
  targetUserId: string,
  action: string,
  options: { reason?: string; season?: string; resolveReports?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: ModerationError }> {
  const admin = await requireAdmin({ mode: 'action' });
  const result = await moderateUser(db, admin.id, targetUserId, action, options);
  if (result.ok) revalidatePath('/[locale]/admin', 'page');
  return result.ok ? { ok: true } : result;
}

/** Şikâyetleri işlemsiz kapat: çözüldü ya da asılsız (reddedildi). */
export async function closeReportsAction(targetUserId: string, status: 'RESOLVED' | 'DISMISSED'): Promise<{ ok: boolean }> {
  const admin = await requireAdmin({ mode: 'action' });
  if (status !== 'RESOLVED' && status !== 'DISMISSED') return { ok: false };
  const result = await closeReports(db, admin.id, targetUserId, status);
  if (result.ok) revalidatePath('/[locale]/admin', 'page');
  return { ok: result.ok };
}
