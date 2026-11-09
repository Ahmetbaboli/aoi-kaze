import { getContent } from '@/content';
import type { LocaleParams } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import PageContainer from '@/components/layout/PageContainer';
import SectionHeading from '@/components/ui/SectionHeading';

export const generateMetadata = ({ params }: LocaleParams) => pageMetadata('about', '/hakkimda', params.locale);

export default function AboutPage({ params }: LocaleParams) {
  const { about } = getContent(params.locale);

  return (
    <PageContainer className="max-w-4xl">
      <SectionHeading title={about.title} subtitle={about.subtitle} />

      <div className="space-y-4 text-lg leading-8">
        {about.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <section aria-labelledby="about-site" className="mt-12">
        <h2 id="about-site" className="mb-4 font-display text-2xl">
          {about.siteTitle}
        </h2>
        <ul className="space-y-3 text-muted">
          {about.siteItems.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="about-skills" className="mt-12">
        <h2 id="about-skills" className="mb-4 font-display text-2xl">
          {about.skillsTitle}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {about.skills.map((skill) => (
            <li key={skill.name} className="rounded-xl border border-line bg-surface p-4 shadow-cel-sm">
              <p className="font-bold">{skill.name}</p>
              <p className="mt-1 text-sm text-muted">{skill.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="about-principles" className="mt-12">
        <h2 id="about-principles" className="mb-4 font-display text-2xl">
          {about.principlesTitle}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          {about.principles.map((principle) => (
            <div key={principle.title}>
              <dt className="font-bold">{principle.title}</dt>
              <dd className="mt-1 text-sm text-muted">{principle.text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PageContainer>
  );
}
