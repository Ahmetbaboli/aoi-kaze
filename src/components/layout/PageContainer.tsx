import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Sayfa gövdesi. className içinde `max-w-*` verilirse varsayılan genişlik (max-w-6xl) yerine o kullanılır. */
export default function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full px-4 py-12 sm:px-6 sm:py-16', !className?.includes('max-w-') && 'max-w-6xl', className)}>
      {children}
    </div>
  );
}
