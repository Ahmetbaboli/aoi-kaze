'use client';

import type { ReactNode } from 'react';
import { LazyMotion, MotionConfig } from 'framer-motion';
import { SessionProvider } from 'next-auth/react';
import WatchlistSync from '@/components/catalog/WatchlistSync';
import { ToastProvider } from './Toast';

// Animasyon özellikleri ilk boyamayı geciktirmesin diye ayrı parçada yüklenir.
const loadFeatures = () => import('@/lib/motion-features').then((module) => module.default);

/**
 * prefers-reduced-motion açıksa Framer Motion dönüşüm animasyonlarını kapatır.
 * Oturum, sunucuda değil istemcide (/api/auth/session) sorgulanır: böylece kök düzen çerez okumaz ve
 * blog, projeler gibi statik sayfalar statik kalır.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <WatchlistSync />
      <LazyMotion features={loadFeatures} strict>
        <MotionConfig reducedMotion="user">
          <ToastProvider>{children}</ToastProvider>
        </MotionConfig>
      </LazyMotion>
    </SessionProvider>
  );
}
