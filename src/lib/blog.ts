import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { defaultLocale, type Locale } from '@/content';
import { slugify } from '@/lib/slug';

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  /** ISO tarih (YYYY-MM-DD) */
  date: string;
  tags: string[];
  /** Tarih sırasına göre otomatik: en eski yazı = 1. bölüm */
  episode: number;
  readingMinutes: number;
}

export interface Post extends PostMeta {
  body: string;
}

const WORDS_PER_MINUTE = 200;

const blogDir = (locale: Locale) => path.join(process.cwd(), 'src', 'content', 'blog', locale);

function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function readAll(locale: Locale): Post[] {
  const dir = blogDir(locale);
  if (!fs.existsSync(dir)) return [];

  const posts = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, file), 'utf8'));
      const words = content.trim().split(/\s+/).length;
      return {
        slug: file.replace(/\.mdx$/, ''),
        title: String(data.title),
        description: String(data.description ?? ''),
        date: toIsoDate(data.date),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        episode: 0,
        readingMinutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
        body: content,
      } satisfies Post;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return posts.map((post, index) => ({ ...post, episode: index + 1 }));
}

/** Yeniden eskiye sıralı yazı listesi (gövde olmadan). */
export function getAllPosts(locale: Locale = defaultLocale): PostMeta[] {
  return readAll(locale)
    .map(({ body: _body, ...meta }) => meta)
    .reverse();
}

export function getPost(slug: string, locale: Locale = defaultLocale): Post | undefined {
  return readAll(locale).find((post) => post.slug === slug);
}

/** prev = bir önceki bölüm, next = bir sonraki bölüm */
export function getAdjacentPosts(slug: string, locale: Locale = defaultLocale) {
  const chronological = getAllPosts(locale).slice().reverse();
  const index = chronological.findIndex((post) => post.slug === slug);
  return {
    prev: index > 0 ? chronological[index - 1] : undefined,
    next: index >= 0 && index < chronological.length - 1 ? chronological[index + 1] : undefined,
  };
}

export interface SearchIndexEntry {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  episode: number;
  /** Markdown işaretlerinden arındırılmış, kısaltılmış gövde metni */
  text: string;
}

const INDEX_TEXT_LENGTH = 900;

/** Komut paleti için hafif arama dizini (başlık, etiket ve gövdenin ilk kısmı). */
export function getSearchIndex(locale: Locale = defaultLocale): SearchIndexEntry[] {
  return readAll(locale)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.description,
      tags: post.tags,
      episode: post.episode,
      text: post.body
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#>*_`\[\]()-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, INDEX_TEXT_LENGTH),
    }))
    .reverse();
}

export interface Heading {
  level: 2 | 3;
  text: string;
  id: string;
}

/** Markdown gövdesindeki ## ve ### başlıklarını (kod blokları hariç) içindekiler için çıkarır. */
export function getHeadings(body: string): Heading[] {
  const withoutCode = body.replace(/```[\s\S]*?```/g, '');
  return Array.from(withoutCode.matchAll(/^(#{2,3})\s+(.+)$/gm)).map((match) => {
    const text = match[2].replace(/[`*_]/g, '').trim();
    return { level: match[1].length as 2 | 3, text, id: slugify(text) };
  });
}
