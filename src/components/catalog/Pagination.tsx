import Link from '@/components/ui/LocLink';
import { fmt } from '@/lib/utils';

interface PaginationProps {
  page: number;
  lastPage: number;
  /** Sayfa numarası verilince tam URL döndürür */
  hrefFor: (page: number) => string;
  labels: { prev: string; next: string; pageOf: string; nav: string };
}

const linkClass =
  'rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold transition hover:bg-fg/5';

export default function Pagination({ page, lastPage, hrefFor, labels }: PaginationProps) {
  if (lastPage <= 1) return null;

  return (
    <nav aria-label={labels.nav} className="mt-12 flex items-center justify-center gap-4">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={linkClass}>
          ← {labels.prev}
        </Link>
      ) : (
        <span aria-hidden="true" className="w-0 sm:w-32" />
      )}
      <span className="font-bold" aria-current="page">
        {fmt(labels.pageOf, { n: page, total: lastPage })}
      </span>
      {page < lastPage ? (
        <Link href={hrefFor(page + 1)} rel="next" className={linkClass}>
          {labels.next} →
        </Link>
      ) : (
        <span aria-hidden="true" className="w-0 sm:w-32" />
      )}
    </nav>
  );
}
