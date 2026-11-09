import { getContent } from '@/content';
import { getAllPosts } from '@/lib/blog';
import type { LocaleParams } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import PageContainer from '@/components/layout/PageContainer';
import SectionHeading from '@/components/ui/SectionHeading';
import PostCard from '@/components/blog/PostCard';

export const generateMetadata = ({ params }: LocaleParams) => pageMetadata('blog', '/blog', params.locale);

export default function BlogPage({ params }: LocaleParams) {
  const c = getContent(params.locale);
  const posts = getAllPosts(c.locale);

  return (
    <PageContainer>
      <SectionHeading title={c.blog.title} subtitle={c.blog.subtitle} />
      {posts.length === 0 ? (
        <p className="text-lg text-muted">{c.blog.empty}</p>
      ) : (
        <ul className="grid gap-6">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} content={c.blog} locale={c.locale} />
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
