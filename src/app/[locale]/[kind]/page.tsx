import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContent } from '@/content';
import { browse, FORMATS, GENRES, isKind, KINDS, SORTS, STATUSES } from '@/lib/catalog';
import type { SortKey } from '@/lib/catalog';
import { toQuery } from '@/lib/catalog/url';
import type { Locale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import { fmt } from '@/lib/utils';
import { cardLabels } from '@/components/catalog/card-labels';
import CatalogGrid from '@/components/catalog/CatalogGrid';
import FilterBar from '@/components/catalog/FilterBar';
import Pagination from '@/components/catalog/Pagination';
import UnavailableNotice from '@/components/catalog/UnavailableNotice';
import PageContainer from '@/components/layout/PageContainer';
import SectionHeading from '@/components/ui/SectionHeading';

type SearchParams = Record<string, string | string[] | undefined>;

interface KindPageProps {
  params: { locale: Locale; kind: string };
  searchParams: SearchParams;
}

// Yalnızca /anime, /manga, /manhwa geçerli; diğerleri 404.
export const dynamicParams = false;
// Her istekte render edilir: AniList hatası önbelleğe girmesin (başarılı yanıtlar fetch önbelleğinde 1 saat tutulur).
export const dynamic = 'force-dynamic';
export const generateStaticParams = () => KINDS.map((kind) => ({ kind }));

export function generateMetadata({ params }: KindPageProps): Metadata {
  return isKind(params.kind) ? pageMetadata(params.kind, `/${params.kind}`, params.locale) : {};
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const oneOf = (value: string | undefined, allowed: string[]) => (value && allowed.includes(value) ? value : undefined);
const intIn = (value: string | undefined, min: number, max: number) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};

export default async function KindPage({ params, searchParams }: KindPageProps) {
  if (!isKind(params.kind)) notFound();
  const kind = params.kind;
  const c = getContent(params.locale);

  const filters = {
    genre: oneOf(first(searchParams.genre), GENRES),
    format: oneOf(first(searchParams.format), FORMATS[kind]),
    status: oneOf(first(searchParams.status), STATUSES),
    year: intIn(first(searchParams.year), 1950, 2100),
    sort: (oneOf(first(searchParams.sort), SORTS) ?? 'popular') as SortKey,
  };
  const page = intIn(first(searchParams.page), 1, 500) ?? 1;

  const result = await browse({ kind, page, ...filters });
  const info = c.catalog.kinds[kind];

  const hrefFor = (target: number) =>
    `/${kind}${toQuery({ ...filters, sort: filters.sort === 'popular' ? undefined : filters.sort, page: target > 1 ? target : undefined })}`;

  return (
    <PageContainer>
      <SectionHeading title={info.title} subtitle={info.subtitle} />
      {result.source === 'curated' && <UnavailableNotice title={c.catalog.curated.title} text={c.catalog.curated.text} />}
      <FilterBar kind={kind} locale={params.locale} content={c.catalog} values={filters} />

      {(
        <p role="status" className="mb-6 text-sm font-semibold text-muted">
          {fmt(c.catalog.results, { n: result.total })}
        </p>
      )}

      {result.items.length === 0 ? (
        <p className="text-lg text-muted">{c.catalog.noResults}</p>
      ) : (
        <CatalogGrid items={result.items} labels={cardLabels(c)} />
      )}

      <Pagination
        page={result.page}
        lastPage={result.lastPage}
        hrefFor={hrefFor}
        labels={{ prev: c.catalog.prevPage, next: c.catalog.nextPage, pageOf: c.catalog.pageOf, nav: c.catalog.paginationLabel }}
      />
    </PageContainer>
  );
}
