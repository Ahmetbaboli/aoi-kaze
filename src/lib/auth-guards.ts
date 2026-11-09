import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { authorize, parseAdminEmails, safeCallbackUrl, type Requirement } from '@/lib/auth-logic';
import { defaultLocale, type Locale } from '@/lib/i18n';

/** Server Action'larda yetkisiz çağrı için atılır (sayfalarda notFound/yönlendirme kullanılır). */
export class ForbiddenError extends Error {
  constructor(message = 'Bu işlem için yetkin yok.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

interface GuardOptions {
  locale?: Locale;
  /** Girişten sonra dönülecek site içi yol (örn. "/tr/hesap"). Güvenli değilse dil ana sayfasına döner. */
  callbackUrl?: string;
}

function loginRedirect({ locale = defaultLocale, callbackUrl }: GuardOptions): never {
  const target = safeCallbackUrl(callbackUrl, `/${locale}`);
  redirect(`/${locale}/giris?callbackUrl=${encodeURIComponent(target)}`);
}

/**
 * Giriş yapmış kullanıcıyı döndürür; yoksa giriş sayfasına yönlendirir.
 * Sunucu bileşenlerinde ve Server Action'larda kullan; middleware yalnızca çerezin varlığına bakar, asıl kontrol burada.
 */
export async function requireUser(options: GuardOptions = {}) {
  const session = await auth();
  if (authorize(session?.user, 'user' satisfies Requirement) !== 'ok') loginRedirect(options);
  return session!.user;
}

/**
 * Yönetici kullanıcıyı döndürür. Rol her çağrıda veritabanından okunur (database oturumu).
 *  - giriş yok          → giriş sayfasına yönlendirme
 *  - giriş var, ADMIN değil → mode "page": 404 (admin sayfasının varlığı belli edilmez) · mode "action": ForbiddenError (403)
 */
export async function requireAdmin(options: GuardOptions & { mode?: 'page' | 'action' } = {}) {
  const { mode = 'page', ...rest } = options;
  const session = await auth();
  // Rol ADMIN olsa da e-posta ADMIN_EMAILS'te değilse yönetici sayılmaz (bkz. effectiveRole).
  const result = authorize(session?.user, 'admin', parseAdminEmails(process.env.ADMIN_EMAILS));
  if (result === 'unauthenticated') loginRedirect(rest);
  if (result === 'forbidden') {
    if (mode === 'action') throw new ForbiddenError();
    notFound();
  }
  return session!.user;
}
