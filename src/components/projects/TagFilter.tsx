'use client';

import { cn } from '@/lib/utils';

interface TagFilterProps {
  tags: string[];
  active: string;
  allValue: string;
  allLabel: string;
  groupLabel: string;
  onChange: (tag: string) => void;
}

export default function TagFilter({ tags, active, allValue, allLabel, groupLabel, onChange }: TagFilterProps) {
  const options = [{ value: allValue, label: allLabel }, ...tags.map((tag) => ({ value: tag, label: tag }))];

  return (
    <div role="group" aria-label={groupLabel} className="mb-8 flex flex-wrap gap-2">
      {options.map((option) => {
        const pressed = active === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition',
              pressed ? 'border-transparent bg-primary text-white' : 'border-line bg-surface text-fg hover:bg-fg/5',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
