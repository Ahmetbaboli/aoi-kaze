import type { Metadata } from 'next';
import Link from '@/components/ui/LocLink';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getContent } from '@/content';
import { getAdjacentPosts, getAllPosts, getHeadings, getPost } from '@/lib/blog';
import { locales, localePath, defaultLocale, type Locale } from '@/lib/i18n';
import { fmt, formatDate } from '@/lib/utils';
import PageContainer from '@/components/layout/PageContainer';
import PostNav from '@/components/blog/PostNav';
import Comments from '@/components/blog/Comments';
import { createMdxComponents, remarkCodeMeta } from '@/components/blog/mdx-components';
import ReadingProgress from '@/components/blog/ReadingProgress';
import TableOfContents from '@/components/blog/TableOfContents';

interface PostPageProps {
  params: { locale: Locale; slug: string };
}

export function generateStaticParams() {
  return locales.flatMap((locale) => getAllPosts(locale).map((post) => ({ locale, slug: post.slug })));
}

export function generateMetadata({ params }: PostPageProps): Metadata {
  const { locale } = params;
  const c = getContent(locale);
  const post = getPost(params.slug, locale);
  if (!post) return {};
  const path = `/blog/${post.slug}`;
  const languages = Object.fromEntries(
    locales.filter((l) => getPost(post.slug, l)).map((l) => [l, localePath(l, path)]),
  );
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: localePath(locale, path), languages: { ...languages, 'x-default': localePath(defaultLocale, path) } },
    openGraph: {
      type: 'article',
      title: `${post.title} | ${c.site.name}`,
      description: post.description,
      url: localePath(locale, path),
      locale: c.ogLocale,
      publishedTime: post.date,
      tags: post.tags,
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description },
  };
}

export default function PostPage({ params }: PostPageProps) {
  const { locale } = params;
  const c = getContent(locale);
  const post = getPost(params.slug, locale);
  if (!post) notFound();

  const { prev, next } = getAdjacentPosts(post.slug, locale);
  const headings = getHeadings(post.body);
  const blog = c.blog;

  return (
    <PageContainer className="max-w-5xl">
      <ReadingProgress targetId="post-article" label={blog.progressLabel} />
      <Link href="/blog" className="mb-8 inline-block text-sm font-semibold text-primary-text hover:underline">
        ← {c.blog.backToList}
      </Link>

      <TableOfContents headings={headings} title={blog.toc} navLabel={blog.tocNav} variant="mobile" />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem]">
      <article id="post-article" className="min-w-0 max-w-3xl">
        <header className="relative mb-10">
          <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-sm font-semibold text-muted">
            <time dateTime={post.date}>{formatDate(post.date, c.locale)}</time> ·{' '}
            {fmt(c.blog.readingTime, { n: post.readingMinutes })}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li key={tag} className="rounded-md bg-fg/5 px-2 py-0.5 text-xs font-semibold text-muted">
                {tag}
              </li>
            ))}
          </ul>
        </header>

        <div className="mdx-body">
          <MDXRemote
            source={post.body}
            components={createMdxComponents({
              copy: blog.copy,
              copied: blog.copied,
              copyAria: blog.copyAria,
              copiedAnnounce: blog.copiedAnnounce,
            })}
            options={{ mdxOptions: { remarkPlugins: [remarkCodeMeta] } }}
          />
        </div>
      </article>
      <TableOfContents headings={headings} title={blog.toc} navLabel={blog.tocNav} variant="desktop" />
      </div>

      <div className="max-w-3xl">
        <Comments title={blog.comments} />
      </div>

      <PostNav prev={prev} next={next} content={c.blog} locale={c.locale} />
    </PageContainer>
  );
}
