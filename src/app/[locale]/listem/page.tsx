import { getContent } from '@/content';
import type { LocaleParams } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import ListView from '@/components/catalog/ListView';
import PageContainer from '@/components/layout/PageContainer';
import SectionHeading from '@/components/ui/SectionHeading';

export const generateMetadata = ({ params }: LocaleParams) => pageMetadata('list', '/listem', params.locale);

export default function ListPage({ params }: LocaleParams) {
  const c = getContent(params.locale);
  const l = c.catalog.list;

  return (
    <PageContainer>
      <SectionHeading title={l.title} subtitle={l.subtitle} />
      <ListView content={c.catalog} />
    </PageContainer>
  );
}
