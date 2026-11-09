import { Children, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react';
import { codeToHtml } from 'shiki';
import Link from '@/components/ui/LocLink';
import { slugify } from '@/lib/slug';
import CopyButton from './CopyButton';

export interface CodeLabels {
  copy: string;
  copied: string;
  copyAria: string;
  copiedAnnounce: string;
}

/** Bir React alt ağacındaki düz metni toplar (başlık kimliği üretmek için). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

type CodeProps = { className?: string; children?: ReactNode; 'data-meta'?: string };

/** Shiki ile sunucuda renklendirilen kod bloğu: dosya adı etiketi + kopyala düğmesi. */
function createPre(labels: CodeLabels) {
  return async function Pre({ children, ...rest }: ComponentProps<'pre'>) {
    const code = Children.toArray(children)[0] as ReactElement<CodeProps> | undefined;
    const text = textOf(code?.props?.children).replace(/\n$/, '');
    const language = /language-([\w-]+)/.exec(code?.props?.className ?? '')?.[1] ?? 'text';
    const title = /title="([^"]+)"/.exec(code?.props?.['data-meta'] ?? '')?.[1];

    let html: string | null = null;
    try {
      html = await codeToHtml(text, {
        lang: language,
        themes: { light: 'github-light-high-contrast', dark: 'github-dark' },
        defaultColor: false,
      });
    } catch {
      html = null; // bilinmeyen dil: düz metin olarak göster
    }

    return (
      <figure className="code-block my-6 overflow-hidden rounded-xl border border-line shadow-cel-sm">
        <figcaption className="flex items-center justify-between gap-3 border-b border-line bg-night px-3 py-1.5 text-sm text-[#F1F3FA]">
          <span className="truncate font-semibold">{title ?? language}</span>
          <CopyButton text={text} labels={labels} />
        </figcaption>
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre tabIndex={0} {...rest}>
            <code>{text}</code>
          </pre>
        )}
      </figure>
    );
  };
}

const headingClass = 'font-display';

/** MDX öğelerinin site temasına uygun karşılıkları. İçerik .mdx dosyalarında, görünüm burada. */
export function createMdxComponents(labels: CodeLabels) {
  return {
    h2: ({ children, ...props }: ComponentProps<'h2'>) => (
      <h2 id={slugify(textOf(children))} className={`${headingClass} mb-3 mt-12 text-2xl sm:text-3xl`} {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: ComponentProps<'h3'>) => (
      <h3 id={slugify(textOf(children))} className="mb-2 mt-8 font-display text-xl" {...props}>
        {children}
      </h3>
    ),
    p: (props: ComponentProps<'p'>) => <p className="my-5 text-lg leading-8" {...props} />,
    ul: (props: ComponentProps<'ul'>) => <ul className="my-5 list-disc space-y-2 pl-6 text-lg marker:text-primary" {...props} />,
    ol: (props: ComponentProps<'ol'>) => <ol className="my-5 list-decimal space-y-2 pl-6 text-lg marker:font-semibold" {...props} />,
    a: ({ href = '', ...props }: ComponentProps<'a'>) =>
      href.startsWith('/') ? (
        <Link href={href} className="font-semibold text-primary-text underline underline-offset-4" {...props} />
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary-text underline underline-offset-4"
          {...props}
        />
      ),
    blockquote: (props: ComponentProps<'blockquote'>) => (
      <blockquote
        className="my-8 rounded-r-xl border-l-4 border-primary bg-fg/5 px-6 py-3 text-lg text-muted [&>p]:my-2"
        {...props}
      />
    ),
    pre: createPre(labels),
    hr: () => <hr className="my-10 border-line" />,
  };
}

/** Kod bloğu bilgi satırındaki (```css title="a.css") metni <code data-meta> olarak iletir. */
export function remarkCodeMeta() {
  type Node = { type: string; meta?: string | null; data?: Record<string, unknown>; children?: Node[] };
  const visit = (node: Node) => {
    if (node.type === 'code' && node.meta) {
      const data = (node.data ??= {});
      data.hProperties = { ...(data.hProperties as object | undefined), 'data-meta': node.meta };
    }
    node.children?.forEach(visit);
  };
  return (tree: Node) => visit(tree);
}
