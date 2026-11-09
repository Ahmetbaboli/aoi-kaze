import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getContent } from '@/content';
import { activeProviders, authErrorKey, safeCallbackUrl } from '@/lib/auth-logic';
import type { Locale } from '@/lib/i18n';
import { fmt } from '@/lib/utils';
import SubmitButton from '@/components/auth/SubmitButton';
import PageContainer from '@/components/layout/PageContainer';
import Link from '@/components/ui/LocLink';
import LogoMark from '@/components/ui/LogoMark';
import { signInWithEmail, signInWithGitHub } from './actions';

interface LoginPageProps {
  params: { locale: Locale };
  searchParams: { error?: string; sent?: string; callbackUrl?: string };
}

export function generateMetadata({ params }: LoginPageProps): Metadata {
  return { title: getContent(params.locale).auth.title, robots: { index: false, follow: false } };
}

// Oturuma ve arama parametrelerine bağlı: her istekte render edilir.
export const dynamic = 'force-dynamic';

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = params;
  const c = getContent(locale);
  const a = c.auth;

  const callbackUrl = safeCallbackUrl(searchParams.callbackUrl, `/${locale}`);

  // Zaten giriş yapmışsa geldiği sayfaya gönder.
  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  const providers = activeProviders(process.env);
  const errorKey = authErrorKey(searchParams.error) ?? (searchParams.error === 'InvalidEmail' ? 'invalidEmail' : null);
  const errorMessage = errorKey ? (a.errors as Record<string, string>)[errorKey] ?? a.errors.generic : null;
  const sentTo = searchParams.sent && searchParams.sent.length <= 80 ? searchParams.sent : null;

  const hidden = (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
    </>
  );

  return (
    <PageContainer className="max-w-md">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-cel-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LogoMark size={44} />
          <h1 className="font-display text-2xl">{sentTo ? a.checkTitle : a.title}</h1>
          <p className="text-muted">{sentTo ? fmt(a.checkText, { email: sentTo }) : a.subtitle}</p>
        </div>

        {errorMessage && (
          <p role="alert" className="mb-5 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary-text">
            {errorMessage}
          </p>
        )}

        {sentTo ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted">{a.checkHint}</p>
            <Link
              href={`/giris?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="inline-block text-sm font-semibold text-primary-text hover:underline"
            >
              {a.tryAnother}
            </Link>
          </div>
        ) : !providers.github && !providers.email ? (
          <p className="text-center text-sm text-muted">{a.disabled}</p>
        ) : (
          <div className="space-y-5">
            {providers.github && (
              <form action={signInWithGitHub}>
                {hidden}
                <SubmitButton variant="secondary" pendingLabel={a.sending}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
                  </svg>
                  {a.github}
                </SubmitButton>
              </form>
            )}

            {providers.github && providers.email && (
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted">
                <span className="h-px flex-1 bg-line" />
                {a.or}
                <span className="h-px flex-1 bg-line" />
              </div>
            )}

            {providers.email && (
              <form action={signInWithEmail} className="space-y-3">
                {hidden}
                <div>
                  <label htmlFor="login-email" className="mb-1 block text-sm font-semibold">
                    {a.emailLabel}
                  </label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    inputMode="email"
                    maxLength={254}
                    placeholder={a.emailPlaceholder}
                    className="field"
                  />
                  <p className="mt-1 text-xs text-muted">{a.emailHint}</p>
                </div>
                <SubmitButton pendingLabel={a.sending}>{a.emailSubmit}</SubmitButton>
              </form>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
