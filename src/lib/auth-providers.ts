import Discord from 'next-auth/providers/discord';
import GitHub from 'next-auth/providers/github';
import Nodemailer from 'next-auth/providers/nodemailer';
import type { Provider } from 'next-auth/providers';
import { activeProviders, MAGIC_LINK_MAX_AGE } from '@/lib/auth-logic';
import { sendMagicLink } from '@/lib/auth-email';

/**
 * Sağlayıcı listesi. Her sağlayıcı yalnızca gerekli ortam değişkenleri tanımlıysa etkindir:
 *   GitHub  : AUTH_GITHUB_ID + AUTH_GITHUB_SECRET
 *   E-posta : EMAIL_SERVER + EMAIL_FROM  (sihirli link, Nodemailer)
 *   Discord : AUTH_DISCORD_ID + AUTH_DISCORD_SECRET  (kodda hazır, ortam değişkeni verilmedikçe kapalı)
 * Giriş sayfası da aynı kuralı (activeProviders) kullanır; yalnızca etkin olanların düğmesi görünür.
 */
export function buildProviders(): Provider[] {
  const active = activeProviders(process.env);
  const providers: Provider[] = [];

  if (active.github) {
    providers.push(
      GitHub({
        // GitHub yalnızca kullanıcının BİRİNCİL e-postasını verir ve GitHub birincil adresin doğrulanmış olmasını
        // zorunlu kılar. Bu yüzden aynı e-postayla önce e-posta, sonra GitHub ile giriş yapan kişiyi tek hesapta
        // birleştirmek güvenlidir (başkası, sahibi olmadığı bir adresle hesabı ele geçiremez).
        allowDangerousEmailAccountLinking: true,
        profile(profile) {
          return {
            id: String(profile.id),
            name: profile.name ?? profile.login,
            email: profile.email,
            image: profile.avatar_url,
            // Kullanıcı adı üretmek için; adaptör sarmalayıcısı bunu veritabanına yazmadan önce ayıklar.
            githubLogin: profile.login,
          };
        },
      }),
    );
  }

  if (active.email) {
    providers.push(
      Nodemailer({
        server: process.env.EMAIL_SERVER,
        from: process.env.EMAIL_FROM,
        maxAge: MAGIC_LINK_MAX_AGE, // 15 dakika
        sendVerificationRequest: sendMagicLink,
      }),
    );
  }

  if (active.discord) {
    // Discord e-postaları doğrulanmamış olabilir; bu yüzden e-posta ile otomatik hesap birleştirme KAPALI bırakıldı.
    providers.push(Discord({}));
  }

  return providers;
}
