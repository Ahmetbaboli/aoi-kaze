// Giriş linki e-postası (tr/en, HTML + düz metin). Hiçbir şey içe aktarmaz; saf fonksiyonlardır.

export type MailLocale = 'tr' | 'en';

export interface MagicLinkMail {
  subject: string;
  html: string;
  text: string;
}

const COPY = {
  tr: {
    subject: 'Aoi Kaze giriş linkin',
    heading: 'Giriş yap',
    intro: 'Aoi Kaze hesabına girmek için aşağıdaki düğmeye tıkla.',
    button: 'Giriş yap',
    validity: (minutes: number) => `Bu link ${minutes} dakika geçerlidir ve yalnızca bir kez kullanılabilir.`,
    ignore: 'Bu isteği sen yapmadıysan bu e-postayı güvenle yok sayabilirsin; hesabına kimse erişemez.',
    fallback: 'Düğme çalışmıyorsa bu adresi tarayıcına yapıştır:',
    plainIntro: 'Aoi Kaze hesabına girmek için bu linke tıkla:',
  },
  en: {
    subject: 'Your Aoi Kaze sign-in link',
    heading: 'Sign in',
    intro: 'Click the button below to sign in to your Aoi Kaze account.',
    button: 'Sign in',
    validity: (minutes: number) => `This link is valid for ${minutes} minutes and can only be used once.`,
    ignore: 'If you did not request this, you can safely ignore this email; nobody can access your account.',
    fallback: 'If the button does not work, paste this address into your browser:',
    plainIntro: 'Click this link to sign in to your Aoi Kaze account:',
  },
} as const;

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Doğrulama adresindeki callbackUrl'in dil önekinden e-posta dilini bulur ("/en/..." -> en); yoksa tr. */
export function mailLocaleFromUrl(url: string): MailLocale {
  try {
    const callback = new URL(url).searchParams.get('callbackUrl');
    if (!callback) return 'tr';
    const path = callback.startsWith('/') ? callback : new URL(callback).pathname;
    return path.split('/')[1] === 'en' ? 'en' : 'tr';
  } catch {
    return 'tr';
  }
}

export function buildMagicLinkMail(options: { url: string; locale: MailLocale; expiresMinutes: number }): MagicLinkMail {
  const copy = COPY[options.locale];
  const url = escapeHtml(options.url);

  const html = `<!doctype html>
<html lang="${options.locale}">
  <body style="margin:0;padding:0;background:#0a0a10;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0a10;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#161620;border:1px solid #2b2b3a;border-radius:16px;">
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#f1f3fa;">Aoi <span style="color:#fb7185;">Kaze</span></p>
                <h1 style="margin:24px 0 8px;font-size:24px;line-height:1.3;color:#f1f3fa;">${escapeHtml(copy.heading)}</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#c4c9dc;">${escapeHtml(copy.intro)}</p>
                <a href="${url}" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:12px 28px;border-radius:10px;">${escapeHtml(copy.button)}</a>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:#94a3b8;">${escapeHtml(copy.validity(options.expiresMinutes))}</p>
                <p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#94a3b8;">${escapeHtml(copy.ignore)}</p>
                <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#64748b;">${escapeHtml(copy.fallback)}<br><a href="${url}" style="color:#fb7185;word-break:break-all;">${url}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [copy.plainIntro, '', options.url, '', copy.validity(options.expiresMinutes), copy.ignore, ''].join('\n');

  return { subject: copy.subject, html, text };
}
