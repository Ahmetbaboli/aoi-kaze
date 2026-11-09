'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/utils';

interface SubmitButtonProps {
  children: ReactNode;
  pendingLabel: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}

/** Form gönderilirken devre dışı kalan ve etiketi değişen düğme (useFormStatus). */
export default function SubmitButton({ children, pendingLabel, variant = 'primary', className }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={cn(
        'inline-flex w-full items-center justify-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold transition duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary' ? 'border-transparent bg-primary text-white hover:bg-primary/90' : 'border-line bg-surface text-fg hover:bg-fg/5',
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
