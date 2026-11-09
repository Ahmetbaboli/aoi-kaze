import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  label: string;
  align?: 'left' | 'right';
  children: ReactNode;
}

/**
 * Küçük ipucu kutusu. Yalnızca görsel ipucu: erişilebilir ad,
 * sarmalanan öğenin kendi aria-label'ından gelir.
 */
export default function Tooltip({ label, align = 'left', children }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute bottom-full mb-2 translate-y-1 whitespace-nowrap rounded-md bg-fg px-2.5 py-1 text-xs font-semibold text-bg opacity-0 shadow-cel-sm transition duration-150 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100',
          align === 'left' ? 'left-0' : 'right-0',
        )}
      >
        {label}
      </span>
    </span>
  );
}
