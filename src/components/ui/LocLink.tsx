'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { localePath } from '@/lib/i18n';
import { useLocale } from './LocaleProvider';

type LocLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

/** next/link gibi çalışır; "/" ile başlayan yolların başına geçerli dil önekini ekler. */
export default function LocLink({ href, ...props }: LocLinkProps) {
  const locale = useLocale();
  return <Link href={localePath(locale, href)} {...props} />;
}
