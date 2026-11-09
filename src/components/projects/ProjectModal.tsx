'use client';

import { useEffect, useRef } from 'react';
import { m } from 'framer-motion';
import type { Content } from '@/content';
import type { Project } from '@/content/types';
import { accentBg } from '@/lib/accent';
import { cn } from '@/lib/utils';

interface ProjectModalProps {
  project: Project;
  labels: Pick<Content['projects'], 'close' | 'yearLabel'>;
  onClose: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled])';

export default function ProjectModal({ project, labels, onClose }: ProjectModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `project-title-${project.id}`;

  // Odak yönetimi, Esc ile kapanma, Tab tuzağı ve arka plan kaydırma kilidi.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <m.div
        aria-hidden="true"
        className="absolute inset-0 bg-night/75"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <m.div
        ref={dialogRef}
        layoutId={`project-${project.id}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface text-fg shadow-cel"
      >
        <div className={cn('relative overflow-hidden border-b border-line p-6 pr-20', accentBg[project.accent])}>
          <p className="relative text-sm font-semibold">
            {labels.yearLabel}: {project.year}
          </p>
          <h2 id={titleId} className="relative font-display text-3xl sm:text-4xl">
            {project.title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={labels.close}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg bg-black/25 text-white transition hover:bg-black/40"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <ul className="mb-4 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <li key={tag} className="rounded-md bg-fg/5 px-2 py-0.5 text-xs font-semibold text-muted">
                {tag}
              </li>
            ))}
          </ul>
          <p className="text-lg leading-relaxed">{project.description}</p>
          {project.links.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-4">
              {project.links.map((link) => (
                <li key={link.href + link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                  >
                    {link.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </m.div>
    </div>
  );
}
