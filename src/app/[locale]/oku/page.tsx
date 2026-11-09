import { getContent } from '@/content';
import type { LocaleParams } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import PageContainer from '@/components/layout/PageContainer';
import LocalReader from '@/components/reader/LocalReader';
import SectionHeading from '@/components/ui/SectionHeading';

export const generateMetadata = ({ params }: LocaleParams) => pageMetadata('reader', '/oku', params.locale);

export default function ReaderPage({ params }: LocaleParams) {
  const { reader } = getContent(params.locale);

  return (
    <PageContainer className="max-w-5xl">
      <SectionHeading title={reader.title} subtitle={reader.subtitle} />
      <LocalReader content={reader} />
      <ul className="mt-8 grid gap-3 text-sm text-muted sm:grid-cols-3">
        {reader.tips.map((tip) => (
          <li key={tip} className="rounded-xl border border-line bg-surface p-4">
            {tip}
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
