import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter, AdapterUser } from '@auth/core/adapters';
import { cookies, headers } from 'next/headers';
import { authConfig } from '@/auth.config';
import { db } from '@/lib/db';
import { parseAdminEmails } from '@/lib/auth-logic';
import { buildProviders } from '@/lib/auth-providers';
import { createUserRecord, promoteIfAdmin } from '@/lib/auth-users';
import { LOCALE_COOKIE, isLocale, pickLocale } from '@/lib/i18n';

/** Kullanıcının o anki site dili: NEXT_LOCALE çerezi, yoksa Accept-Language, yoksa tr. */
function currentLocale(): 'tr' | 'en' {
  try {
    const cookie = cookies().get(LOCALE_COOKIE)?.value;
    if (isLocale(cookie)) return cookie;
    return pickLocale(headers().get('accept-language'));
  } catch {
    return 'tr'; // istek bağlamı dışında (ör. betik)
  }
}

const baseAdapter = PrismaAdapter(db);

/**
 * Prisma adaptörünü sarar:
 *  - createUser : kullanıcı adı üretir, e-postayı küçük harfe çevirir, dili ve rolü ayarlar (auth-users.ts).
 *  - getUserByEmail : arama e-postayı küçük harfe çevirir (kayıtlar küçük harfle tutulur).
 */
const adapter: Adapter = {
  ...baseAdapter,
  async createUser(data) {
    const { githubLogin, ...user } = data as AdapterUser & { githubLogin?: string };
    const created = await createUserRecord(
      db,
      { name: user.name, email: user.email, image: user.image, emailVerified: user.emailVerified, githubLogin },
      { locale: currentLocale(), adminEmails: parseAdminEmails(process.env.ADMIN_EMAILS) },
    );
    return created as unknown as AdapterUser;
  },
  async getUserByEmail(email) {
    return baseAdapter.getUserByEmail!(email.toLowerCase());
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  providers: buildProviders(),
  callbacks: {
    // Veritabanı oturumunda `user` her istekte veritabanından gelir: rol değişiklikleri hemen etkili olur.
    session({ session, user }) {
      const row = user as AdapterUser & { username?: string | null; role?: 'USER' | 'ADMIN'; locale?: string; avatarUrl?: string | null };
      session.user.id = row.id;
      session.user.username = row.username ?? null;
      session.user.role = row.role ?? 'USER';
      session.user.locale = row.locale ?? 'tr';
      // Profilde seçilen avatar (AniList görseli) sağlayıcı avatarının önüne geçer.
      if (row.avatarUrl) session.user.image = row.avatarUrl;
      return session;
    },
  },
  events: {
    // ADMIN_EMAILS listesindeki e-postayla her girişte (mevcut kullanıcılar dahil) ADMIN'e terfi.
    async signIn({ user }) {
      if (user?.id) await promoteIfAdmin(db, { id: user.id, email: user.email }, parseAdminEmails(process.env.ADMIN_EMAILS));
    },
  },
});
