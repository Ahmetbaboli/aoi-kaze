import { getContent } from '@/content';
import type { LocaleParams } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import PageContainer from '@/components/layout/PageContainer';
import SectionHeading from '@/components/ui/SectionHeading';
import ProjectsView from '@/components/projects/ProjectsView';

export const generateMetadata = ({ params }: LocaleParams) => pageMetadata('projects', '/projeler', params.locale);

export default function ProjectsPage({ params }: LocaleParams) {
  const { projects } = getContent(params.locale);

  return (
    <PageContainer>
      <SectionHeading title={projects.title} subtitle={projects.subtitle} />
      <ProjectsView content={projects} />
    </PageContainer>
  );
}
