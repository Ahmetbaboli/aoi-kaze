import type { Metadata } from 'next';
import { getContent } from '@/content';
import { requireAdmin } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';
import PageContainer from '@/components/layout/PageContainer';
import SectionHeading from '@/components/ui/SectionHeading';

interface AdminPageProps {
  params: { locale: Locale };
}

export function generateMetadata({ params }: AdminPageProps): Metadata {
  return { title: getContent(params.locale).auth.adminPage.title, robots: { index: false, follow: false } };
}

export const dynamic = 'force-dynamic';

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = params;
  // Rol her istekte veritabanından okunur. Yönetici değilse 404 (sayfanın varlığı belli edilmez).
  await requireAdmin({ locale, callbackUrl: `/${locale}/admin`, mode: 'page' });
  const a = getContent(locale).auth.adminPage;

  return (
    <PageContainer className="max-w-2xl">
      <SectionHeading title={a.title} subtitle={a.text} />
    </PageContainer>
  );
}
