import Link from '@/components/ui/LocLink';
import type { Content } from '@/content';
import { FORMATS, GENRES, SORTS, STATUSES } from '@/lib/catalog/constants';
import type { Kind, SortKey } from '@/lib/catalog/types';
import { localePath, type Locale } from '@/lib/i18n';
import Button from '@/components/ui/Button';

interface FilterBarProps {
  kind: Kind;
  locale: Locale;
  content: Content['catalog'];
  values: { genre?: string; format?: string; status?: string; year?: number; sort: SortKey };
}

/** JavaScript gerektirmeyen GET formu: URL paylaşılabilir, geri tuşu doğal çalışır. */
export default function FilterBar({ kind, locale, content, values }: FilterBarProps) {
  const f = content.filters;

  const select = (name: string, label: string, options: { value: string; label: string }[], current?: string, withAll = true) => (
    <div>
      <label htmlFor={`f-${name}`} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      <select id={`f-${name}`} name={name} defaultValue={current ?? ''} className="field">
        {withAll && <option value="">{f.all}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <form
      method="get"
      action={localePath(locale, `/${kind}`)}
      aria-label={f.title}
      className="mb-10 grid gap-4 rounded-xl border border-line bg-surface p-4 shadow-cel-sm sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
    >
      {select('genre', f.genre, GENRES.map((g) => ({ value: g, label: content.genres[g] ?? g })), values.genre)}
      {select('format', f.format, FORMATS[kind].map((v) => ({ value: v, label: content.formats[v] ?? v })), values.format)}
      {select('status', f.status, STATUSES.map((v) => ({ value: v, label: content.statuses[v] ?? v })), values.status)}
      <div>
        <label htmlFor="f-year" className="mb-1 block text-sm font-semibold">
          {f.year}
        </label>
        <input
          id="f-year"
          name="year"
          type="number"
          inputMode="numeric"
          min={1950}
          max={2100}
          defaultValue={values.year ?? ''}
          placeholder={f.yearPlaceholder}
          className="field"
        />
      </div>
      {select('sort', f.sort, SORTS.map((v) => ({ value: v, label: content.sorts[v] })), values.sort, false)}
      <div className="flex items-center gap-3">
        <Button type="submit" className="!px-5">
          {f.apply}
        </Button>
        <Link href={`/${kind}`} className="text-sm font-semibold text-primary-text hover:underline">
          {f.reset}
        </Link>
      </div>
    </form>
  );
}
