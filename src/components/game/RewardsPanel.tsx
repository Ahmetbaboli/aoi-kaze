'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { Content } from '@/content';
import { equipAction } from '@/lib/game/actions';
import { REWARD_SLOT, type RewardItem } from '@/lib/game/game-logic';
import { cn, fmt } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface RewardsPanelProps {
  owned: { item: RewardItem; bestRank: number }[];
  equipped: { frame: string | null; name: string | null; title: string | null };
  content: Content['game']['rewards'];
}

const PREVIEW: Record<RewardItem, string> = {
  frame_gold: 'frame-gold',
  frame_silver: 'frame-silver',
  frame_bronze: 'frame-bronze',
  name_gradient: 'name-gradient',
  name_color: 'name-color',
  title_champion: '',
};

/** Sahip olunan kozmetikler: tak / çıkar. */
export default function RewardsPanel({ owned, equipped, content: r }: RewardsPanelProps) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  if (owned.length === 0) return <p className="text-sm text-muted">{r.none}</p>;

  const toggle = (item: RewardItem, isOn: boolean) =>
    startTransition(async () => {
      const result = await equipAction(REWARD_SLOT[item], isOn ? null : item);
      if (result.ok) {
        push(isOn ? r.unequip : `${r.equipped}: ${r.items[item]}`);
        router.refresh();
      }
    });

  return (
    <ul className="space-y-2">
      {owned.map(({ item, bestRank }) => {
        const slot = REWARD_SLOT[item];
        const isOn = equipped[slot] === item;
        return (
          <li key={item} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
            <span aria-hidden="true" className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', slot === 'frame' && PREVIEW[item])}>
              <span className="flex h-full w-full items-center justify-center rounded-full bg-night text-sm">
                {slot === 'frame' ? '🖼️' : slot === 'name' ? <span className={cn('font-black', PREVIEW[item])}>Aa</span> : '🏆'}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{r.items[item]}</span>
              <span className="block text-xs text-muted">{fmt(r.bestRank, { n: bestRank })}</span>
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => toggle(item, isOn)}
              aria-pressed={isOn}
              className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50', isOn ? 'border-transparent bg-primary text-white' : 'border-line hover:bg-fg/5')}
            >
              {isOn ? r.equipped : r.equip}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
