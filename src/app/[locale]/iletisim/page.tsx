import { getContent } from '@/content';
import { getSocials } from '@/content/socials';
import type { LocaleParams } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import PageContainer from '@/components/layout/PageContainer';
import SectionHeading from '@/components/ui/SectionHeading';
import ContactForm from '@/components/contact/ContactForm';
import SocialLinks from '@/components/contact/SocialLinks';

export const generateMetadata = ({ params }: LocaleParams) => pageMetadata('contact', '/iletisim', params.locale);

export default function ContactPage({ params }: LocaleParams) {
  const { contact } = getContent(params.locale);
  const socials = getSocials(contact.socialLabels);

  return (
    <PageContainer>
      <SectionHeading title={contact.title} subtitle={contact.subtitle} />
      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <ContactForm content={contact.form} />
        {socials.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-xl">{contact.socialTitle}</h2>
            <SocialLinks socials={socials} label={contact.socialNav} />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
