'use client';

import type { Content } from '@/content';
import { defaultLocale } from '@/lib/i18n';
import PageContainer from '@/components/layout/PageContainer';
import Button from './Button';
import { useLocale } from './LocaleProvider';

export default function NotFoundView({ content }: { content: Record<string, Content['notFound']> }) {
  const locale = useLocale();
  const c = content[locale] ?? content[defaultLocale];

  return (
    <PageContainer className="flex min-h-[60vh] items-center justify-center">
      <div className="flex max-w-xl flex-col items-center gap-4 text-center">
        <p className="text-sm font-semibold text-primary-text">{c.code}</p>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{c.title}</h1>
        <p className="text-muted">{c.text}</p>
        <Button href="/" className="mt-2">
          {c.back}
        </Button>
      </div>
    </PageContainer>
  );
}
