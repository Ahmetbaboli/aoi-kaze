import type { Kind, SortKey } from './types';

export const KINDS: Kind[] = ['anime', 'manga', 'manhwa'];

export const isKind = (value: string): value is Kind => (KINDS as string[]).includes(value);

/** AniList tür adları (API değerleri). Türkçe karşılıkları content/tr.ts içinde. */
export const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

export const FORMATS: Record<Kind, string[]> = {
  anime: ['TV', 'TV_SHORT', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'],
  manga: ['MANGA', 'NOVEL', 'ONE_SHOT'],
  manhwa: ['MANGA', 'NOVEL', 'ONE_SHOT'],
};

export const STATUSES = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'HIATUS', 'CANCELLED'];

export const SORTS: SortKey[] = ['popular', 'score', 'trending', 'new', 'title'];

export const PER_PAGE = 24;
