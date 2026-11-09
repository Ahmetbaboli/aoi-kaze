import type { PersonFacts } from '@/lib/catalog/types';

/** URL'deki sayısal kimlik (1–9 hane); geçersizse null → 404. */
export const parseId = (value: string) => (/^\d{1,9}$/.test(value) ? Number(value) : null);

/** "12 Mart" ya da "12 Mart 1990"; ay yoksa null. */
export function formatBirthday(birthday: PersonFacts['birthday'], locale: string): string | null {
  if (!birthday?.month) return birthday?.year ? String(birthday.year) : null;
  const date = new Date(Date.UTC(birthday.year ?? 2000, birthday.month - 1, birthday.day ?? 1));
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'long',
    ...(birthday.day ? { day: 'numeric' } : {}),
    ...(birthday.year ? { year: 'numeric' } : {}),
  }).format(date);
}

/** Boş olmayan bilgi satırlarını sırayla toplar. */
export const factRows = (rows: [string, string | null | undefined][]) =>
  rows.filter((row): row is [string, string] => !!row[1]).map(([label, value]) => ({ label, value }));
