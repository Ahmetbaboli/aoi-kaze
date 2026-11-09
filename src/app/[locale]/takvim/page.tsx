import Link from '@/components/ui/LocLink';
import { getContent } from '@/content';
import { getSchedule } from '@/lib/catalog';
import type { ScheduleEntry } from '@/lib/catalog';
import type { LocaleParams } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import { fmt } from '@/lib/utils';
import CoverArt from '@/components/catalog/CoverArt';
import UnavailableNotice from '@/components/catalog/UnavailableNotice';
import PageContainer from '@/components/layout/PageContainer';
import SectionHeading from '@/components/ui/SectionHeading';

export const generateMetadata = ({ params }: LocaleParams) => pageMetadata('schedule', '/takvim', params.locale);
// Her istekte render edilir: AniList hatası önbelleğe girmesin (başarılı yanıtlar fetch önbelleğinde 1 saat tutulur).
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;
const DAYS = 7;

export default async function SchedulePage({ params }: LocaleParams) {
  const c = getContent(params.locale);
  const s = c.catalog.schedule;
  const tz = s.timezone;

  const now = Date.now();
  const fetched = await getSchedule(Math.floor(now / 1000), Math.floor((now + DAYS * DAY_MS) / 1000));
  const entries = fetched ?? [];

  const keyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const labelFormat = new Intl.DateTimeFormat(c.locale, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' });
  const timeFormat = new Intl.DateTimeFormat(c.locale, { timeZone: tz, hour: '2-digit', minute: '2-digit' });

  const byDay = new Map<string, ScheduleEntry[]>();
  entries.forEach((entry) => {
    const key = keyFormat.format(entry.airingAt * 1000);
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  });

  const days = Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(now + i * DAY_MS);
    return { key: keyFormat.format(date), label: labelFormat.format(date), today: i === 0 };
  });

  return (
    <PageContainer>
      <SectionHeading title={s.title} subtitle={s.subtitle} />
      {fetched === null && <UnavailableNotice title={c.catalog.unavailable.title} text={c.catalog.unavailable.text} />}

      {fetched !== null && (
      <div className="grid gap-8">
        {days.map((day) => {
          const list = (byDay.get(day.key) ?? []).sort((a, b) => a.airingAt - b.airingAt);
          return (
            <section key={day.key} aria-labelledby={`day-${day.key}`}>
              <h2 id={`day-${day.key}`} className="mb-3 flex flex-wrap items-center gap-3 font-display text-xl sm:text-2xl">
                {day.today && <span className="rounded-md bg-primary px-2 py-0.5 text-sm text-white">{s.today}</span>}
                {day.label}
              </h2>
              {list.length === 0 ? (
                <p className="text-muted">{s.empty}</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((entry) => (
                    <li key={`${entry.media.id}-${entry.episode}`}>
                      <Link
                        href={`/anime/${entry.media.id}`}
                        className="group relative flex items-center gap-3 rounded-xl border border-line bg-surface p-2 shadow-cel-sm transition hover:shadow-cel"
                      >
                        <span className="relative block aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md bg-night">
                          <CoverArt media={entry.media} sizes="48px" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-lg font-extrabold text-primary-text">
                            {timeFormat.format(entry.airingAt * 1000)}
                          </span>
                          <span className="line-clamp-1 block font-bold">{entry.media.title}</span>
                          <span className="block text-sm text-muted">{fmt(s.episodeShort, { n: entry.episode })}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      )}
    </PageContainer>
  );
}
