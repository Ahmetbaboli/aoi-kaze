// Kullanıcı kaydı mantığı. İçe aktarmalar yalnızca tür ve .ts uzantılıdır: `scripts/test-auth.mjs`
// bu dosyayı Node'un TypeScript desteğiyle doğrudan çalıştırıp PGlite üzerinde test eder.
import type { PrismaClient } from '@prisma/client';
import { isAdminEmail, roleForEmail, usernameBase, usernameCandidate, type Role } from './auth-logic.ts';
import { checkUsername } from './profile/moderation.ts';

type Db = Pick<PrismaClient, 'user' | 'session'>;

export interface NewUserInput {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
  /** GitHub kullanıcı adı (kullanıcı adı üretmek için); veritabanına yazılmaz. */
  githubLogin?: string | null;
}

export interface NewUserContext {
  /** Kullanıcının o anki site dili (tr/en). */
  locale: 'tr' | 'en';
  adminEmails: string[];
}

const MAX_ATTEMPTS = 50;

const isUniqueViolation = (error: unknown, field: string): boolean => {
  const e = error as { code?: string; meta?: { target?: unknown } };
  if (e?.code !== 'P2002') return false;
  const target = e.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? '').includes(field);
};

/**
 * Yeni kullanıcıyı oluşturur: kullanıcı adı üretilir (çakışmada sona sayı eklenir), e-posta küçük harfe çevrilir,
 * dil site dilinden alınır, ADMIN_EMAILS listesindeki e-posta ADMIN rolü alır.
 * İki eşzamanlı kayıt aynı adı seçerse benzersizlik hatası yakalanıp sonraki aday denenir.
 */
export async function createUserRecord(db: Db, input: NewUserInput, context: NewUserContext) {
  const email = input.email ? input.email.trim().toLowerCase() : null;
  const generated = usernameBase({ githubLogin: input.githubLogin, email, name: input.name });
  // GitHub adı / e-postadan üretilen ad küfürlü ya da ayrılmışsa ("admin" vb.) nötr bir ada düşülür.
  const base = checkUsername(generated) === 'profanity' || checkUsername(generated) === 'reserved' ? 'uye' : generated;
  const role: Role = roleForEmail(email, context.adminEmails);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const username = usernameCandidate(base, attempt);
    try {
      return await db.user.create({
        data: {
          name: input.name ?? null,
          email,
          emailVerified: input.emailVerified ?? null,
          image: input.image ?? null,
          username,
          locale: context.locale,
          role,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error, 'username')) continue; // adı başkası aldı: sonrakini dene
      throw error; // e-posta çakışması vb. gerçek hatalar
    }
  }
  throw new Error('Benzersiz kullanıcı adı üretilemedi');
}

/**
 * ADMIN_EMAILS listesindeki e-postayla giriş yapan kullanıcıyı ADMIN yapar (her girişte; mevcut kullanıcılar dahil).
 * Yalnızca terfi eder, listeden çıkarılanı otomatik düşürmez (bunu admin panelinden elle yap).
 * Güven: e-posta GitHub'ın doğrulanmış birincil adresi ya da e-posta linkiyle kanıtlanmış adrestir.
 */
export async function promoteIfAdmin(db: Db, user: { id: string; email?: string | null }, adminEmails: string[]): Promise<boolean> {
  if (!isAdminEmail(user.email, adminEmails)) return false;
  const result = await db.user.updateMany({ where: { id: user.id, role: 'USER' }, data: { role: 'ADMIN' } });
  return result.count > 0;
}

/** Oturum çerezindeki belirteçten kullanıcıyı bulur; süresi dolmuşsa null (Auth.js'in database oturumunun yaptığı iş). */
export async function findSessionUser(db: Db, sessionToken: string, now: Date = new Date()) {
  const session = await db.session.findUnique({ where: { sessionToken }, include: { user: true } });
  if (!session || session.expires <= now) return null;
  return session.user;
}
