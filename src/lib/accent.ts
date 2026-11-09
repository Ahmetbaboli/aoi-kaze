import type { Accent } from '@/content/types';

/** Vurgu rengine göre dolgu + okunaklı yazı rengi (kapak görseli yoksa kullanılır). */
export const accentBg: Record<Accent, string> = {
  primary: 'bg-primary text-white',
  volt: 'bg-electric text-white',
  night: 'bg-night text-[#F1F3FA]',
};
