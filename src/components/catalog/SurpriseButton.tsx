'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from '@/components/ui/LocaleProvider';
import { localePath } from '@/lib/i18n';

interface SurpriseButtonProps {
  items: { id: number; kind: string }[];
  label: string;
  hint: string;
}

/** Elindeki listeden rastgele bir esere götürür ("Ne izlesem?"). */
export default function SurpriseButton({ items, label, hint }: SurpriseButtonProps) {
  const router = useRouter();
  const locale = useLocale();
  if (items.length === 0) return null;

  const pick = () => {
    const item = items[Math.floor(Math.random() * items.length)];
    router.push(localePath(locale, `/${item.kind}/${item.id}`));
  };

  return (
    <div className="mt-10 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
      <span aria-hidden="true" className="text-3xl">
        🎲
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg">{label}</p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <button
        type="button"
        onClick={pick}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 active:scale-95"
      >
        {label}
      </button>
    </div>
  );
}
