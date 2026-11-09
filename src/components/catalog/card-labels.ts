import type { Content } from '@/content';

/** MediaCard'a geçirilen metinler: kart hem sunucu hem istemci bileşenlerinde kullanılır. */
export interface CardLabels {
  open: string;
  score: string;
  episodes: string;
  chapters: string;
  formats: Record<string, string>;
  kinds: Record<string, string>;
}

export const cardLabels = (c: Content): CardLabels => ({
  open: c.catalog.openCard,
  score: c.catalog.scoreLabel,
  episodes: c.catalog.episodesCount,
  chapters: c.catalog.chaptersCount,
  formats: c.catalog.formats,
  kinds: c.catalog.kindLabel,
});
