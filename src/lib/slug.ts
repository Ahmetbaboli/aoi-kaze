import { fold } from './text';

/** "CSS ile Halftone!" -> "css-ile-halftone" (başlık bağlantıları ve içindekiler için ortak). */
export const slugify = (text: string) =>
  fold(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
