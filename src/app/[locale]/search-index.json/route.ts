import { NextResponse } from 'next/server';
import { getSearchIndex } from '@/lib/blog';
import { isLocale, locales } from '@/lib/i18n';

// Build sırasında her dil için üretilen statik blog arama dizini (palet ilk açılışta çeker).
export const dynamic = 'force-static';
export const generateStaticParams = () => locales.map((locale) => ({ locale }));

export function GET(_request: Request, { params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return NextResponse.json([], { status: 404 });
  return NextResponse.json(getSearchIndex(params.locale));
}
