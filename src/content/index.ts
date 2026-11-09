import { defaultLocale, type Locale } from '@/lib/i18n';
import { en } from './en';
import { tr } from './tr';

export { defaultLocale, isLocale, locales } from '@/lib/i18n';
export type { Locale } from '@/lib/i18n';
export type Content = typeof tr;

const dictionaries: Record<Locale, Content> = { tr, en };

export const getContent = (locale: Locale = defaultLocale): Content => dictionaries[locale];
