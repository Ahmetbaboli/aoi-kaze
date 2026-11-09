import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, isLocale, locales, pickLocale } from '@/lib/i18n';

/** Giriş gerektiren yollar (dil öneki çıkarıldıktan sonra). Asıl yetki kontrolü sunucu bileşenlerinde / Server Action'larda yapılır. */
const PROTECTED = /^\/(hesap|admin)(\/|$)/;

/** Auth.js oturum çerezleri (HTTPS'te "__Secure-" önekli; uzun değerler ".0", ".1" gibi parçalanabilir). */
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'];

/**
 * Edge'de çalışır, veritabanına dokunmaz: yalnızca oturum çerezinin VARLIĞINA bakar (geçerliliğine değil).
 * Çerez sahte ya da süresi dolmuş olabilir; bu yüzden bu yalnızca bir kolaylıktır, güvenlik sınırı değildir.
 */
const hasSessionCookie = (request: NextRequest) =>
  request.cookies.getAll().some(({ name }) => SESSION_COOKIES.some((base) => name === base || name.startsWith(`${base}.`)));

/**
 * 1) Dil önekli olmayan adresleri (/anime, /) tercih edilen dile yönlendirir:
 *    önce NEXT_LOCALE çerezi, yoksa Accept-Language, o da yoksa varsayılan (tr).
 * 2) Dil önekli ve korumalı bir yol için oturum çerezi yoksa giriş sayfasına yönlendirir (callbackUrl ile).
 * Sıra önemli: önce dil eklenir, korumalı yol kontrolü bir sonraki istekte (dil önekli adreste) yapılır.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split('/')[1];

  if (locales.some((locale) => locale === first)) {
    const rest = pathname.slice(first.length + 1) || '/';
    if (PROTECTED.test(rest) && !hasSessionCookie(request)) {
      const url = request.nextUrl.clone();
      url.pathname = `/${first}/giris`;
      url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url, 307);
    }
    return NextResponse.next();
  }

  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : pickLocale(request.headers.get('accept-language'));

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  url.search = search;
  const response = NextResponse.redirect(url, 307);
  response.headers.set('Vary', 'Accept-Language, Cookie');
  return response;
}

export const config = {
  // API, statik dosyalar ve meta rotaları hariç her şey
  matcher: ['/((?!api|_next|images|favicon.ico|robots.txt|sitemap.xml|opengraph-image).*)'],
};
