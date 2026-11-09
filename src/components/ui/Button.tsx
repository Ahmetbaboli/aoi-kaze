import type { MouseEvent, ReactNode } from 'react';
import Link from '@/components/ui/LocLink';
import { cn } from '@/lib/utils';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

const variants = {
  primary: 'border-transparent bg-primary text-white hover:bg-primary/90',
  secondary: 'border-line bg-surface text-fg hover:bg-fg/5',
};

export default function Button({ children, variant = 'primary', href, type = 'button', disabled, className, onClick }: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center rounded-lg border px-5 py-2.5 text-sm font-semibold transition duration-150 hover:-translate-y-px hover:shadow-cel-sm active:translate-y-0 active:scale-95',
    'disabled:cursor-not-allowed disabled:opacity-60',
    variants[variant],
    className,
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
