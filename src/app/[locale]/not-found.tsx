import { getContent, locales } from '@/content';
import NotFoundView from '@/components/ui/NotFoundView';

/**
 * not-found sayfaları route parametresi alamaz; bu yüzden tüm dillerin metni istemciye
 * (küçük bir parça olarak) verilir ve geçerli dil bağlamdan seçilir.
 */
export default function NotFound() {
  const content = Object.fromEntries(locales.map((locale) => [locale, getContent(locale).notFound]));
  return <NotFoundView content={content} />;
}
