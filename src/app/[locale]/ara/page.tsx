import { Suspense } from 'react';
import { getContent } from '@/content';
import type { LocaleParams } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import { cardLabels } from '@/components/catalog/card-labels';
import LiveSearch from '@/components/catalog/LiveSearch';
import PageContainer from '@/components/layout/PageContainer';
import SectionHeading from '@/components/ui/SectionHeading';

export const generateMetadata = ({ params }: LocaleParams) => pageMetadata('search', '/ara', params.locale);

export default function SearchPage({ params }: LocaleParams) {
  const c = getContent(params.locale);
  const s = c.catalog.search;

  return (
    <PageContainer>
      <SectionHeading title={s.title} subtitle={s.subtitle} />
      <Suspense fallback={null}>
        <LiveSearch labels={s} card={cardLabels(c)} />
      </Suspense>
    </PageContainer>
  );
}
