// Kullanıcı şikâyetleri ve yönetici işlemleri. İçe aktarmalar yalnızca tür ve .ts uzantılıdır:
// `scripts/test-admin.mjs` bu dosyayı Node'un TypeScript desteğiyle doğrudan çalıştırıp PGlite üzerinde test eder.
//
// Yetki: bu fonksiyonlar yöneticiyi doğrulamaz (Server Action'lar requireAdmin ile çağırır); ama hedef kurallarını
// burada uygular: yönetici kendine ve başka bir yöneticiye işlem yapamaz. Her işlem AdminAction'a yazılır.
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

import { USER_REPORT_REASONS, type UserReportReason } from './reasons.ts';
export { USER_REPORT_REASONS, type UserReportReason };
export const REPORT_NOTE_MAX = 300;
/** Aynı kişi aynı profili en fazla bu sıklıkla şikâyet edebilir. */
export const USER_REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
/** Kişi başına günlük şikâyet sınırı (kötüye kullanıma karşı). */
export const USER_REPORT_DAILY_MAX = 20;
export const BAN_REASON_MAX = 200;

export type ReportUserError = 'unauthorized' | 'invalid_reason' | 'note_too_long' | 'not_found' | 'self' | 'cooldown' | 'daily_limit';

const clean = (text: string) => text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

/** Profili şikâyet et (Server Action'ın çekirdeği). Hedef kullanıcı adıyla bulunur. */
export async function reportUser(
  db: PrismaClient,
  reporterId: string | null | undefined,
  input: { username: unknown; reason: unknown; note?: unknown },
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; error: ReportUserError }> {
  if (!reporterId) return { ok: false, error: 'unauthorized' };
  if (typeof input.reason !== 'string' || !(USER_REPORT_REASONS as readonly string[]).includes(input.reason)) return { ok: false, error: 'invalid_reason' };
  let note: string | null = null;
  if (input.note !== undefined && input.note !== null && input.note !== '') {
    if (typeof input.note !== 'string') return { ok: false, error: 'note_too_long' };
    note = clean(input.note) || null;
    if (note && note.length > REPORT_NOTE_MAX) return { ok: false, error: 'note_too_long' };
  }
  if (typeof input.username !== 'string' || !/^[a-z0-9_]{1,20}$/i.test(input.username)) return { ok: false, error: 'not_found' };
  const target = await db.user.findUnique({ where: { username: input.username.toLowerCase() }, select: { id: true, bannedAt: true } });
  if (!target || target.bannedAt) return { ok: false, error: 'not_found' };
  if (target.id === reporterId) return { ok: false, error: 'self' };

  const recent = await db.report.findFirst({
    where: { userId: reporterId, targetType: 'USER', targetId: target.id, createdAt: { gt: new Date(now.getTime() - USER_REPORT_COOLDOWN_MS) } },
    select: { id: true },
  });
  if (recent) return { ok: false, error: 'cooldown' };
  const today = await db.report.count({ where: { userId: reporterId, targetType: 'USER', createdAt: { gt: new Date(now.getTime() - 86_400_000) } } });
  if (today >= USER_REPORT_DAILY_MAX) return { ok: false, error: 'daily_limit' };

  await db.report.create({ data: { userId: reporterId, targetType: 'USER', targetId: target.id, reason: input.reason, note, createdAt: now } });
  return { ok: true };
}

/* ------------------------------ Kuyruk ve arama ------------------------------ */

export interface QueueItem {
  user: { id: string; username: string | null; name: string | null; bio: string | null; avatar: string | null; banner: string | null; profilePublic: boolean; bannedAt: Date | null; role: string; createdAt: Date };
  count: number;
  reasons: Partial<Record<UserReportReason, number>>;
  notes: { note: string; reason: string; createdAt: Date }[];
  firstAt: Date;
  lastAt: Date;
}

/** Açık kullanıcı şikâyetleri, hedef kullanıcıya göre gruplanmış; en çok şikâyet edilen başta. */
export async function listReportQueue(db: PrismaClient): Promise<QueueItem[]> {
  const reports = await db.report.findMany({ where: { targetType: 'USER', status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 1000 });
  const byTarget = new Map<string, typeof reports>();
  for (const r of reports) byTarget.set(r.targetId, [...(byTarget.get(r.targetId) ?? []), r]);
  const users = await db.user.findMany({ where: { id: { in: [...byTarget.keys()] } } });
  return users
    .map((u) => {
      const list = byTarget.get(u.id)!;
      const reasons: Partial<Record<UserReportReason, number>> = {};
      for (const r of list) reasons[r.reason as UserReportReason] = (reasons[r.reason as UserReportReason] ?? 0) + 1;
      return {
        user: { id: u.id, username: u.username, name: u.name, bio: u.bio, avatar: u.avatarUrl ?? u.image, banner: u.bannerUrl, profilePublic: u.profilePublic, bannedAt: u.bannedAt, role: u.role, createdAt: u.createdAt },
        count: list.length,
        reasons,
        notes: list.filter((r) => r.note).slice(0, 5).map((r) => ({ note: r.note!, reason: r.reason, createdAt: r.createdAt })),
        firstAt: list[list.length - 1].createdAt,
        lastAt: list[0].createdAt,
      };
    })
    .sort((a, b) => b.count - a.count || b.lastAt.getTime() - a.lastAt.getTime());
}

/** Kullanıcı arama (ad, kullanıcı adı, e-posta); boş sorguda en yeni üyeler. */
export async function searchUsers(db: PrismaClient, query: string, take = 20) {
  const q = query.trim().slice(0, 60);
  const users = await db.user.findMany({
    where: q ? { OR: [{ username: { contains: q.toLowerCase() } }, { email: { contains: q.toLowerCase() } }, { name: { contains: q, mode: 'insensitive' } }] } : undefined,
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, username: true, name: true, email: true, role: true, bannedAt: true, banReason: true, profilePublic: true, createdAt: true, avatarUrl: true, image: true },
  });
  const openCounts = await db.report.groupBy({ by: ['targetId'], where: { targetType: 'USER', status: 'OPEN', targetId: { in: users.map((u) => u.id) } }, _count: { _all: true } });
  const countBy = new Map(openCounts.map((c) => [c.targetId, c._count._all]));
  return users.map((u) => ({ ...u, avatar: u.avatarUrl ?? u.image, openReports: countBy.get(u.id) ?? 0 }));
}

export async function getAdminOverview(db: PrismaClient, now: Date = new Date()) {
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [users, newUsers, banned, openUserReports, openSourceReports, flaggedSources, playsToday] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gt: dayAgo } } }),
    db.user.count({ where: { bannedAt: { not: null } } }),
    db.report.count({ where: { targetType: 'USER', status: 'OPEN' } }),
    db.report.count({ where: { targetType: 'SOURCE', status: 'OPEN' } }),
    db.episodeSource.count({ where: { needsReview: true } }),
    db.gamePlay.count({ where: { startedAt: { gt: dayAgo } } }),
  ]);
  return { users, newUsers, banned, openUserReports, openSourceReports, flaggedSources, playsToday };
}

export async function listAdminActions(db: PrismaClient, take = 30) {
  const actions = await db.adminAction.findMany({ orderBy: { createdAt: 'desc' }, take, include: { actor: { select: { username: true } } } });
  const targets = await db.user.findMany({ where: { id: { in: actions.map((a) => a.targetUserId).filter((x): x is string => !!x) } }, select: { id: true, username: true } });
  const nameBy = new Map(targets.map((t) => [t.id, t.username]));
  return actions.map((a) => ({ id: a.id, action: a.action, actor: a.actor.username, target: a.targetUserId ? (nameBy.get(a.targetUserId) ?? null) : null, details: a.details, createdAt: a.createdAt }));
}

/* ------------------------------ Yönetici işlemleri ------------------------------ */

export const MODERATION_ACTIONS = ['reset_username', 'clear_bio', 'reset_images', 'hide_profile', 'ban', 'unban', 'clear_scores'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];
export type ModerationError = 'invalid' | 'not_found' | 'self' | 'target_admin' | 'reason_required';

/** Sıfırlanan kullanıcı adı yerine nötr, benzersiz bir ad (kullanıcı hemen yenisini seçebilir). */
async function neutralUsername(db: PrismaClient): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = `uye_${randomBytes(4).toString('hex')}`;
    if (!(await db.user.findUnique({ where: { username: candidate }, select: { id: true } }))) return candidate;
  }
  throw new Error('nötr kullanıcı adı üretilemedi');
}

/**
 * Yönetici işlemi uygular. `resolveReports` true ise hedefin açık şikâyetleri "çözüldü" olarak kapatılır.
 *  - reset_username : ad nötr bir adla değişir; ad değiştirme bekleme süresi sıfırlanır
 *  - clear_bio      : biyografi silinir        · reset_images : avatar ve banner kaldırılır
 *  - hide_profile   : profil gizlenir          · clear_scores : bu sezonun (ya da verilen sezonun) oyun puanları silinir
 *  - ban            : giriş yasaklanır, açık oturumlar kapatılır (gerekçe zorunlu) · unban : yasak kalkar
 */
export async function moderateUser(
  db: PrismaClient,
  actorId: string,
  targetUserId: unknown,
  action: unknown,
  options: { reason?: unknown; season?: unknown; resolveReports?: boolean } = {},
  now: Date = new Date(),
): Promise<{ ok: true; details?: Record<string, unknown> } | { ok: false; error: ModerationError }> {
  if (typeof targetUserId !== 'string' || !(MODERATION_ACTIONS as readonly string[]).includes(action as string)) return { ok: false, error: 'invalid' };
  const act = action as ModerationAction;
  if (targetUserId === actorId) return { ok: false, error: 'self' };
  const target = await db.user.findUnique({ where: { id: targetUserId } });
  if (!target) return { ok: false, error: 'not_found' };
  if (target.role === 'ADMIN') return { ok: false, error: 'target_admin' };

  const reason = typeof options.reason === 'string' ? clean(options.reason).slice(0, BAN_REASON_MAX) : '';
  if (act === 'ban' && !reason) return { ok: false, error: 'reason_required' };
  const season = typeof options.season === 'string' && /^\d{4}-W\d{2}$/.test(options.season) ? options.season : null;

  const details: Record<string, unknown> = {};
  // Nötr ad işlemden ÖNCE üretilir: işlem içinden ayrı bağlantıyla sorgu, tek bağlantılı havuzda kilitlenir.
  const newUsername = act === 'reset_username' ? await neutralUsername(db) : null;
  await db.$transaction(async (tx) => {
    switch (act) {
      case 'reset_username': {
        const username = newUsername!;
        details.from = target.username;
        details.to = username;
        await tx.user.update({ where: { id: target.id }, data: { username, usernameChangedAt: null } });
        break;
      }
      case 'clear_bio':
        details.bio = target.bio;
        await tx.user.update({ where: { id: target.id }, data: { bio: null } });
        break;
      case 'reset_images':
        await tx.user.update({ where: { id: target.id }, data: { avatarUrl: null, bannerUrl: null } });
        break;
      case 'hide_profile':
        await tx.user.update({ where: { id: target.id }, data: { profilePublic: false } });
        break;
      case 'ban':
        details.reason = reason;
        await tx.user.update({ where: { id: target.id }, data: { bannedAt: now, banReason: reason } });
        await tx.session.deleteMany({ where: { userId: target.id } }); // açık oturumlar hemen kapanır
        break;
      case 'unban':
        await tx.user.update({ where: { id: target.id }, data: { bannedAt: null, banReason: null } });
        break;
      case 'clear_scores': {
        const removed = await tx.gamePlay.deleteMany({ where: { userId: target.id, ...(season ? { season } : {}) } });
        details.season = season ?? 'all';
        details.removed = removed.count;
        break;
      }
    }
    if (options.resolveReports) {
      const closed = await tx.report.updateMany({
        where: { targetType: 'USER', targetId: target.id, status: 'OPEN' },
        data: { status: 'RESOLVED', resolvedById: actorId, resolvedAt: now },
      });
      details.resolvedReports = closed.count;
    }
    await tx.adminAction.create({ data: { actorId, targetUserId: target.id, action: act, details: details as object, createdAt: now } });
  });
  return { ok: true, details };
}

/** Şikâyetleri işlem yapmadan kapat (asılsız bulunduysa "reddedildi"). */
export async function closeReports(db: PrismaClient, actorId: string, targetUserId: unknown, status: 'RESOLVED' | 'DISMISSED', now: Date = new Date()) {
  if (typeof targetUserId !== 'string') return { ok: false as const, error: 'invalid' as const };
  const closed = await db.report.updateMany({
    where: { targetType: 'USER', targetId: targetUserId, status: 'OPEN' },
    data: { status, resolvedById: actorId, resolvedAt: now },
  });
  await db.adminAction.create({
    data: { actorId, targetUserId, action: status === 'DISMISSED' ? 'dismiss_report' : 'resolve_report', details: { count: closed.count }, createdAt: now },
  });
  return { ok: true as const, count: closed.count };
}
