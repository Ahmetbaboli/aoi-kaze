'use server';

import 'server-only';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth-guards';
import { submitBrokenReport, type ReportResult } from './report-core.ts';

/**
 * Bozuk kaynak bildirimi (Server Action). Giriş zorunludur: girişsiz çağrı giriş sayfasına yönlendirir.
 * Neden: NOT_PLAYING | WRONG_EPISODE | BAD_QUALITY | BAD_SUBTITLE | OTHER; not en fazla 300 karakter.
 * Aynı kullanıcı aynı kaynağı 24 saatte bir kez bildirebilir. Kaynak otomatik devre dışı bırakılmaz.
 */
export async function reportBrokenSource(sourceId: string, reason: string, note?: string): Promise<ReportResult> {
  const user = await requireUser();
  return submitBrokenReport(db, user.id, { sourceId, reason, note });
}
