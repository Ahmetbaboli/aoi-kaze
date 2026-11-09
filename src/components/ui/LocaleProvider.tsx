'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { defaultLocale, type Locale } from '@/lib/i18n';

const LocaleContext = createContext<Locale>(defaultLocale);

/** Geçerli dili alt bileşenlere (LocLink, palet, arama...) taşır. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
