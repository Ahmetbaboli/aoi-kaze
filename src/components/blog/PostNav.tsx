import Link from '@/components/ui/LocLink';
import type { Content } from '@/content';
import type { PostMeta } from '@/lib/blog';
import { cn, formatDate } from '@/lib/utils';

interface PostNavProps {
  prev?: PostMeta;
  next?: PostMeta;
  content: Content['blog'];
  locale: string;
}

function NavLink({ post, label, align, locale }: { post: PostMeta; label: string; align: 'left' | 'right'; locale: string }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        'block rounded-xl border border-line bg-surface p-4 shadow-cel-sm transition hover:shadow-cel',
        align === 'right' && 'text-right',
      )}
    >
      <span className="block text-sm font-semibold text-muted">
        {align === 'left' ? '← ' : ''}
        {label}
        {align === 'right' ? ' →' : ''}
      </span>
      <span className="mt-1 block font-display text-lg">{post.title}</span>
      <span className="block text-sm text-muted">{formatDate(post.date, locale)}</span>
    </Link>
  );
}

export default function PostNav({ prev, next, content, locale }: PostNavProps) {
  return (
    <nav aria-label={content.navLabel} className="mt-14 grid gap-6 sm:grid-cols-2">
      {prev ? <NavLink post={prev} label={content.prev} align="left" locale={locale} /> : <span aria-hidden="true" />}
      {next && <NavLink post={next} label={content.next} align="right" locale={locale} />}
    </nav>
  );
}
