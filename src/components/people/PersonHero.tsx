import Image from 'next/image';
import type { ReactNode } from 'react';
import Card from '@/components/ui/Card';

interface PersonHeroProps {
  name: string;
  nameNative: string | null;
  image: string | null;
  /** Ad altındaki küçük satırlar (favori sayısı, meslek...) */
  subtitle?: ReactNode;
  facts: { label: string; value: string }[];
  factsTitle: string;
  children?: ReactNode;
}

/** Karakter ve kişi sayfalarının üst bölümü: portre, ad, bilgi tablosu ve açıklama (children). */
export default function PersonHero({ name, nameNative, image, subtitle, facts, factsTitle, children }: PersonHeroProps) {
  return (
    <div className="grid gap-8 md:grid-cols-[15rem_1fr]">
      <div className="space-y-5">
        <Card className="mx-auto w-48 shadow-cel md:w-full">
          <div className="relative aspect-[3/4] bg-night">
            {image ? (
              <Image src={image} alt="" fill priority sizes="(min-width: 768px) 15rem, 12rem" className="object-cover" />
            ) : (
              <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary to-night text-6xl font-black text-white/80">
                {name.slice(0, 1)}
              </span>
            )}
          </div>
        </Card>
        {facts.length > 0 && (
          <Card innerClassName="p-4">
            <h2 className="mb-2 font-display text-base">{factsTitle}</h2>
            <dl className="space-y-1.5 text-sm">
              {facts.map((fact) => (
                <div key={fact.label} className="flex justify-between gap-3 border-b border-line pb-1 last:border-0">
                  <dt className="font-semibold">{fact.label}</dt>
                  <dd className="text-right text-muted">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </div>
      <div className="min-w-0 md:pt-4">
        <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-5xl">{name}</h1>
        {nameNative && (
          <p lang="ja" className="mt-2 text-lg text-muted">
            {nameNative}
          </p>
        )}
        {subtitle && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">{subtitle}</div>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
