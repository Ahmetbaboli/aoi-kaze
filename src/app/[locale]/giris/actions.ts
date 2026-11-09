'use server';

import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { isValidEmail, maskEmail, safeCallbackUrl } from '@/lib/auth-logic';
import { isMagicLinkRateLimited } from '@/lib/auth-email';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';

function readLocale(formData: FormData): Locale {
  const value = formData.get('locale');
  return typeof value === 'string' && isLocale(value) ? value : defaultLocale;
}

/** Form alanından gelen callbackUrl yalnızca site içi bir yol olabilir; aksi halde dil ana sayfası. */
function readCallback(formData: FormData, locale: Locale): string {
  const value = formData.get('callbackUrl');
  return safeCallbackUrl(typeof value === 'string' ? value : null, `/${locale}`);
}

const loginUrl = (locale: Locale, params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  return `/${locale}/giris${query ? `?${query}` : ''}`;
};

export async function signInWithGitHub(formData: FormData) {
  const locale = readLocale(formData);
  const callbackUrl = readCallback(formData, locale);
  try {
    await signIn('github', { redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) redirect(loginUrl(locale, { error: error.type, callbackUrl }));
    throw error; // NEXT_REDIRECT dahil: yönlendirmeyi engelleme
  }
}

export async function signInWithEmail(formData: FormData) {
  const locale = readLocale(formData);
  const callbackUrl = readCallback(formData, locale);
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!isValidEmail(email)) redirect(loginUrl(locale, { error: 'InvalidEmail', callbackUrl }));

  // Aynı adrese dakikada en fazla 1 link (kullanıcıya anlaşılır hata; sağlayıcıda ikinci savunma hattı da var).
  if (await isMagicLinkRateLimited(email)) redirect(loginUrl(locale, { error: 'RateLimited', callbackUrl }));

  try {
    await signIn('nodemailer', { email, redirect: false, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) {
      const rateLimited = String(error.cause?.err?.message ?? error.message).includes('RateLimited');
      redirect(loginUrl(locale, { error: rateLimited ? 'RateLimited' : 'EmailSignin', callbackUrl }));
    }
    throw error;
  }

  // Adres yalnızca maskelenmiş olarak URL'ye yazılır (a***@gmail.com).
  redirect(loginUrl(locale, { sent: maskEmail(email), callbackUrl }));
}
