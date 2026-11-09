import Link from '@/components/ui/LocLink';
import type { Content } from '@/content';
import type { PostMeta } from '@/lib/blog';
import { fmt, formatDate } from '@/lib/utils';
import Card from '@/components/ui/Card';

interface PostCardProps {
  post: PostMeta;
  content: Content['blog'];
  locale: string;
}

export default function PostCard({ post, content, locale }: PostCardProps) {
  return (
    <li>
      <Link href={`/blog/${post.slug}`} className="group block">
        <Card className="transition-shadow duration-150 group-hover:shadow-cel" innerClassName="p-5 sm:p-6">
          <p className="text-sm font-semibold text-muted">
            <time dateTime={post.date}>{formatDate(post.date, locale)}</time> · {fmt(content.readingTime, { n: post.readingMinutes })}
          </p>
          <h2 className="mt-1 font-display text-xl group-hover:text-primary-text sm:text-2xl">{post.title}</h2>
          <p className="mt-2 text-muted">{post.description}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li key={tag} className="rounded-md bg-fg/5 px-2 py-0.5 text-xs font-semibold text-muted">
                {tag}
              </li>
            ))}
          </ul>
        </Card>
      </Link>
    </li>
  );
}
