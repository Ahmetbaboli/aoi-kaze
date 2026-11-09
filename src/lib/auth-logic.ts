/**
 * Kimlik doğrulamanın saf (yan etkisiz) mantığı. Bu dosya BİLEREK hiçbir şey içe aktarmaz:
 * hem Edge/Node'da hem de `node scripts/test-auth.mjs` içinde (Node'un TypeScript desteğiyle) çalışabilsin.
 */

export type Role = 'USER' | 'ADMIN';
export type Requirement = 'user' | 'admin';
export type Authorization = 'ok' | 'unauthenticated' | 'forbidden';

/* ------------------------------ Yönetici e-postaları ------------------------------ */

/** "A@x.com, b@y.com" -> ["a@x.com", "b@y.com"] (küçük harf, boşluksuz, tekrarsız). */
export function parseAdminEmails(raw: string | undefined | null): string[] {
  const list = (raw ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(list));
}

export function isAdminEmail(email: string | null | undefined, adminEmails: string[]): boolean {
  return !!email && adminEmails.includes(email.trim().toLowerCase());
}

export const roleForEmail = (email: string | null | undefined, adminEmails: string[]): Role =>
  isAdminEmail(email, adminEmails) ? 'ADMIN' : 'USER';

/**
 * Geçerli rol: veritabanında ADMIN olması YETMEZ, e-posta hâlâ ADMIN_EMAILS'te de olmalı.
 * Böylece listeden çıkarılan kişi yeniden giriş yapmasa bile yetkisini anında kaybeder.
 * Liste boşsa (ya da tanımsızsa) kimse yönetici sayılmaz (güvenli varsayılan).
 */
export const effectiveRole = (user: { role?: Role | string | null; email?: string | null }, adminEmails: string[]): Role =>
  user.role === 'ADMIN' && isAdminEmail(user.email, adminEmails) ? 'ADMIN' : 'USER';

/* ------------------------------ Kullanıcı adı ------------------------------ */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Küçük harf, yalnızca [a-z0-9_], 3–20 karakter. Boş ya da çok kısaysa "user" ile tamamlanır. */
export function sanitizeUsername(raw: string | null | undefined): string {
  const cleaned = (raw ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // aksanları at (é -> e)
    .toLowerCase()
    .replace(/ı/g, 'i') // NFKD "ı"yı ayrıştırmaz
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, USERNAME_MAX);
  if (cleaned.length >= USERNAME_MIN) return cleaned;
  return (cleaned + 'user').slice(0, USERNAME_MAX);
}

/** Öncelik: GitHub kullanıcı adı, sonra e-postanın @ öncesi, sonra görünen ad. */
export function usernameBase(source: { githubLogin?: string | null; email?: string | null; name?: string | null }): string {
  const fromEmail = source.email ? source.email.split('@')[0] : null;
  return sanitizeUsername(source.githubLogin || fromEmail || source.name || 'user');
}

/** Çakışmada sona sayı ekler; toplam uzunluk 20'yi aşmaz. attempt 0 = ekleme yok. */
export function usernameCandidate(base: string, attempt: number): string {
  if (attempt === 0) return base;
  const suffix = String(attempt + 1); // 2, 3, 4…
  return base.slice(0, USERNAME_MAX - suffix.length) + suffix;
}

/* ------------------------------ Yönlendirme güvenliği ------------------------------ */

/**
 * callbackUrl yalnızca site içi bir yol olabilir ("/tr/listem?x=1"). Mutlak adresler, "//evil.com",
 * "/\evil.com", "javascript:" ve satır sonu içeren değerler reddedilir (açık yönlendirme açığı olmasın).
 */
export function safeCallbackUrl(value: string | null | undefined, fallback: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  // Giriş sayfasına geri dönüp döngüye girme
  if (/^\/(?:[a-z]{2}\/)?giris(?:[/?#]|$)/.test(value)) return fallback;
  return value;
}

/* ------------------------------ E-posta gösterimi ------------------------------ */

/** "ayse.yilmaz@gmail.com" -> "a***@gmail.com" */
export function maskEmail(email: string): string {
  const [local, domain] = email.trim().split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

export const isValidEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length <= 254;

/* ------------------------------ Yetki ------------------------------ */

/**
 * Yetki kararı. 'admin' için rol ADMIN olmalı VE e-posta adminEmails içinde olmalı (liste verilmezse kimse admin değil).
 * adminEmails parametresi bilerek isteğe bağlı bırakıldı ve varsayılanı boş: unutulursa yetki VERİLMEZ.
 */
export function authorize(
  user: { role?: Role | string | null; email?: string | null } | null | undefined,
  need: Requirement,
  adminEmails: string[] = [],
): Authorization {
  if (!user) return 'unauthenticated';
  if (need === 'admin' && effectiveRole(user, adminEmails) !== 'ADMIN') return 'forbidden';
  return 'ok';
}

/* ------------------------------ Kayıt dili ------------------------------ */

export type SiteLocale = 'tr' | 'en';

/** Giriş sayfasının dilini kayıt anına taşıyan kısa ömürlü çerez (giriş eylemleri yazar, kullanıcı oluşturma okur). */
export const LOGIN_LOCALE_COOKIE = 'aoikaze_login_locale';

const asLocale = (value: string | null | undefined): SiteLocale | null => (value === 'tr' || value === 'en' ? value : null);

/** "/en/listem" ya da "https://site/en/listem" → en. Dil öneki yoksa null. */
export function localeFromPath(path: string | null | undefined): SiteLocale | null {
  if (!path) return null;
  let pathname = path;
  if (!pathname.startsWith('/')) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      return null;
    }
  }
  return asLocale(pathname.split('/')[1]);
}

/** Accept-Language başlığındaki ilk tr/en eşleşmesi ("de,en;q=0.8,tr" → en). */
export function localeFromAcceptLanguage(header: string | null | undefined): SiteLocale | null {
  for (const part of (header ?? '').toLowerCase().split(',')) {
    const found = asLocale(part.trim().slice(0, 2));
    if (found) return found;
  }
  return null;
}

/**
 * Kayıt dili önceliği:
 *   1) giriş sayfasının dili: giriş formundan taşınan değer, sonra callbackUrl'in dil öneki
 *   2) NEXT_LOCALE çerezi
 *   3) Accept-Language
 *   4) tr
 */
export function resolveSignupLocale(input: {
  loginLocale?: string | null;
  callbackUrl?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): SiteLocale {
  return (
    asLocale(input.loginLocale) ??
    localeFromPath(input.callbackUrl) ??
    asLocale(input.cookieLocale) ??
    localeFromAcceptLanguage(input.acceptLanguage) ??
    'tr'
  );
}

/* ------------------------------ Sağlayıcılar (yalnızca ortam değişkenleri) ------------------------------ */

type Env = Record<string, string | undefined>;
const filled = (env: Env, name: string) => Boolean((env[name] ?? '').trim());

/** Bir sağlayıcı yalnızca gerekli tüm ortam değişkenleri tanımlıysa etkindir. */
export function activeProviders(env: Env): { github: boolean; email: boolean; discord: boolean } {
  return {
    github: filled(env, 'AUTH_GITHUB_ID') && filled(env, 'AUTH_GITHUB_SECRET'),
    email: filled(env, 'EMAIL_SERVER') && filled(env, 'EMAIL_FROM'),
    discord: filled(env, 'AUTH_DISCORD_ID') && filled(env, 'AUTH_DISCORD_SECRET'),
  };
}

/* ------------------------------ Hata kodları ------------------------------ */

export type AuthErrorKey = 'expired' | 'linked' | 'emailFailed' | 'denied' | 'provider' | 'rateLimited' | 'generic';

/** Auth.js hata kodunu arayüz mesajı anahtarına çevirir. */
export function authErrorKey(code: string | null | undefined): AuthErrorKey | null {
  if (!code) return null;
  switch (code) {
    case 'Verification':
      return 'expired';
    case 'OAuthAccountNotLinked':
      return 'linked';
    case 'EmailSignin':
    case 'EmailSignInError':
      return 'emailFailed';
    case 'AccessDenied':
      return 'denied';
    case 'OAuthSignin':
    case 'OAuthCallback':
    case 'OAuthCallbackError':
    case 'Callback':
      return 'provider';
    case 'RateLimited':
      return 'rateLimited';
    default:
      return 'generic';
  }
}

/** Giriş linki geçerlilik süresi (saniye) ve gönderim aralığı (saniye). */
export const MAGIC_LINK_MAX_AGE = 15 * 60;
export const MAGIC_LINK_COOLDOWN = 60;

/**
 * Hız sınırı eşiği: bitiş zamanı bu andan ilerideyse link son MAGIC_LINK_COOLDOWN saniye içinde oluşturulmuştur
 * (kayıtlar MAGIC_LINK_MAX_AGE süreyle yaşar, bitiş = oluşturma + MAX_AGE).
 */
export const magicLinkCutoff = (now: Date = new Date()): Date => new Date(now.getTime() + (MAGIC_LINK_MAX_AGE - MAGIC_LINK_COOLDOWN) * 1000);
