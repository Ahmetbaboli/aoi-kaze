import 'server-only';
import type { PrismaClient } from '@prisma/client';

export const REPORT_REASONS = ['NOT_PLAYING', 'WRONG_EPISODE', 'BAD_QUALITY', 'BAD_SUBTITLE', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_NOTE_MAX = 300;
/** brokenReports bu değere ulaşınca kaynak admin incelemesi için işaretlenir (needsReview). Otomatik devre dışı bırakma YOK. */
export const REPORT_REVIEW_THRESHOLD = 5;
/** Aynı kullanıcı aynı kaynağı en fazla bu sürede bir kez bildirebilir. */
export const REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type ReportError = 'unauthorized' | 'invalid_source' | 'invalid_reason' | 'note_too_long' | 'not_found' | 'rate_limited';
export type ReportResult = { ok: true; brokenReports: number; flagged: boolean } | { ok: false; error: ReportError };

export interface ReportInput {
  sourceId: unknown;
  reason: unknown;
  note?: unknown;
}

/** Kontrol karakterlerini boşluğa çevirir, kenar boşluklarını atar; boşsa null. */
const cleanNote = (note: string): string | null => {
  const cleaned = note.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
};

/**
 * Bozuk kaynak bildirimi (Server Action'ın çekirdeği; testler doğrudan bunu çağırır).
 *  - kullanıcı zorunlu (userId yoksa 'unauthorized')
 *  - neden: sabit liste; not: en fazla 300 karakter
 *  - aynı kullanıcı + aynı kaynak: 24 saatte bir (kullanıcı+kaynak başına danışma kilidiyle, çift tıklamada bile tek kayıt)
 *  - Report kaydı + EpisodeSource.brokenReports artışı tek işlemde; eşik aşılınca needsReview=true
 * `now` testlerde zamanı kaydırmak içindir.
 */
export async function submitBrokenReport(
  db: PrismaClient,
  userId: string | null | undefined,
  input: ReportInput,
  now: Date = new Date(),
): Promise<ReportResult> {
  if (!userId) return { ok: false, error: 'unauthorized' };

  if (typeof input.sourceId !== 'string' || input.sourceId.length === 0 || input.sourceId.length > 100) {
    return { ok: false, error: 'invalid_source' };
  }
  const sourceId = input.sourceId;

  if (typeof input.reason !== 'string' || !(REPORT_REASONS as readonly string[]).includes(input.reason)) {
    return { ok: false, error: 'invalid_reason' };
  }
  const reason = input.reason as ReportReason;

  let note: string | null = null;
  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== 'string') return { ok: false, error: 'note_too_long' };
    note = cleanNote(input.note);
    if (note && note.length > REPORT_NOTE_MAX) return { ok: false, error: 'note_too_long' };
  }

  return db.$transaction(async (tx) => {
    // Aynı kullanıcı + kaynak için işlemleri sıraya sokar (işlem bitince kilit kalkar).
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${`${userId}:${sourceId}`}))) AS lock`;

    const source = await tx.episodeSource.findUnique({ where: { id: sourceId }, select: { id: true } });
    if (!source) return { ok: false, error: 'not_found' } as const;

    const since = new Date(now.getTime() - REPORT_COOLDOWN_MS);
    const recent = await tx.report.findFirst({
      where: { userId, targetType: 'SOURCE', targetId: sourceId, createdAt: { gt: since } },
      select: { id: true },
    });
    if (recent) return { ok: false, error: 'rate_limited' } as const;

    await tx.report.create({ data: { userId, targetType: 'SOURCE', targetId: sourceId, reason, note } });
    const updated = await tx.episodeSource.update({
      where: { id: sourceId },
      data: { brokenReports: { increment: 1 } },
      select: { brokenReports: true },
    });

    const flagged = updated.brokenReports >= REPORT_REVIEW_THRESHOLD;
    if (flagged) await tx.episodeSource.update({ where: { id: sourceId }, data: { needsReview: true } });

    return { ok: true, brokenReports: updated.brokenReports, flagged } as const;
  });
}
