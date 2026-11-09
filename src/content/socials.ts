import type { Social, SocialId } from './types';

/**
 * Sosyal bağlantılar kodda değil ortam değişkenlerinde tutulur; tanımlı olmayan hiç gösterilmez
 * (böylece sayfada sahte "github.com" gibi yer tutucu bağlantılar çıkmaz).
 * NEXT_PUBLIC_ değişkenleri build sırasında gömülür.
 */
const isHttps = (value: string | undefined): value is string => !!value && /^https:\/\//i.test(value);
const isEmail = (value: string | undefined): value is string => !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function getSocials(labels: Record<SocialId, string>): Social[] {
  const github = process.env.NEXT_PUBLIC_SOCIAL_GITHUB;
  const linkedin = process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN;
  const twitter = process.env.NEXT_PUBLIC_SOCIAL_TWITTER;
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  const socials: Social[] = [];
  if (isHttps(github)) socials.push({ id: 'github', label: labels.github, href: github });
  if (isHttps(linkedin)) socials.push({ id: 'linkedin', label: labels.linkedin, href: linkedin });
  if (isHttps(twitter)) socials.push({ id: 'twitter', label: labels.twitter, href: twitter });
  if (isEmail(email)) socials.push({ id: 'mail', label: labels.mail, href: `mailto:${email}` });
  return socials;
}
