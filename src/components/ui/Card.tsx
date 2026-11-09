import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'surface' | 'primary' | 'volt' | 'night';

interface CardProps {
  as?: ElementType;
  tone?: Tone;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
}

const tones: Record<Tone, string> = {
  surface: 'bg-surface text-fg',
  primary: 'bg-primary text-white',
  volt: 'bg-volt text-ink',
  night: 'bg-night text-[#F1F3FA]',
};

export default function Card({ as: Tag = 'div', tone = 'surface', className, innerClassName, children }: CardProps) {
  return (
    <Tag className={cn('relative overflow-hidden rounded-xl border border-line shadow-cel-sm', tones[tone], className)}>
      <div className={cn('relative', innerClassName)}>{children}</div>
    </Tag>
  );
}
