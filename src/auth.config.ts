import type { NextAuthConfig } from 'next-auth';

/**
 * Edge uyumlu ortak yapılandırma: sayfa yolları ve oturum ayarları, veritabanı YOK.
 * Prisma adaptörü, sağlayıcılar ve callback'ler yalnızca Node çalışma zamanında yüklenen src/auth.ts içindedir.
 *
 * Sayfa yolları dil önekisizdir ("/giris"); src/middleware.ts bunları tercih edilen dile ("/tr/giris") yönlendirir.
 */
export const authConfig = {
  pages: {
    signIn: '/giris',
    error: '/giris',
  },
  // Veritabanı oturumları: oturumlar sunucudan iptal edilebilir ve rol her istekte veritabanından okunur.
  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  providers: [],
} satisfies NextAuthConfig;
