import { createTransport } from 'nodemailer';
import { db } from '@/lib/db';
import { MAGIC_LINK_MAX_AGE, magicLinkCutoff } from '@/lib/auth-logic';
import { buildMagicLinkMail, mailLocaleFromUrl } from '@/lib/auth-email-template';

/**
 * Bir adrese son MAGIC_LINK_COOLDOWN saniye içinde link gönderilmiş mi?
 * Ayrı bir tablo gerekmez: Auth.js her link için bir VerificationToken kaydı tutar ve süresi
 * MAGIC_LINK_MAX_AGE'dir; bitiş zamanı (şimdi + MAGIC_LINK_MAX_AGE - COOLDOWN)'dan ilerideyse kayıt son dakikada oluşmuştur.
 * `extra`: Auth.js, e-postayı göndermeden ÖNCE yeni linkin kaydını oluşturur; o kayıt da sayıldığı için
 * gönderim sırasındaki kontrolde extra = 1 verilir.
 */
export async function recentMagicLinkCount(identifier: string): Promise<number> {
  return db.verificationToken.count({ where: { identifier: identifier.toLowerCase(), expires: { gt: magicLinkCutoff() } } });
}

export async function isMagicLinkRateLimited(identifier: string): Promise<boolean> {
  return (await recentMagicLinkCount(identifier)) > 0;
}

interface SendParams {
  identifier: string;
  url: string;
  provider: { server?: unknown; from?: string };
}

/**
 * Auth.js e-posta sağlayıcısı için gönderici. Hız sınırı burada da uygulanır (giriş formu eylemi zaten önceden
 * kontrol eder; bu, doğrudan /api/auth çağrılarına karşı ikinci savunmadır).
 */
export async function sendMagicLink({ identifier, url, provider }: SendParams): Promise<void> {
  if ((await recentMagicLinkCount(identifier)) > 1) {
    // En yeni (şimdi oluşturulan) kaydı sil ki sınır dışı denemeler yeni link bırakmasın.
    const newest = await db.verificationToken.findFirst({ where: { identifier: identifier.toLowerCase() }, orderBy: { expires: 'desc' } });
    if (newest) await db.verificationToken.deleteMany({ where: { identifier: newest.identifier, token: newest.token } });
    throw new Error('RateLimited');
  }

  const mail = buildMagicLinkMail({
    url,
    locale: mailLocaleFromUrl(url),
    expiresMinutes: MAGIC_LINK_MAX_AGE / 60,
  });

  const transport = createTransport(provider.server as Parameters<typeof createTransport>[0]);
  const result = await transport.sendMail({
    to: identifier,
    from: provider.from,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });

  const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
  if (failed.length > 0) throw new Error(`E-posta gönderilemedi: ${failed.join(', ')}`);
}
