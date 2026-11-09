'use client';

import Image from 'next/image';
import { m } from 'framer-motion';
import type { Project } from '@/content/types';
import { accentBg } from '@/lib/accent';
import { cn } from '@/lib/utils';
import Card from '@/components/ui/Card';

interface ProjectCardProps {
  project: Project;
  openLabel: string;
  onOpen: (id: string) => void;
}

/** layoutId, modaldaki panelle eşleşir: kart tıklanınca panel büyüyerek açılır. */
export default function ProjectCard({ project, openLabel, onOpen }: ProjectCardProps) {
  return (
    <m.button
      layoutId={`project-${project.id}`}
      type="button"
      onClick={() => onOpen(project.id)}
      aria-haspopup="dialog"
      aria-label={`${project.title} — ${openLabel}`}
      className="group block h-full w-full text-left"
    >
      <Card className="h-full transition-shadow duration-150 group-hover:shadow-cel" innerClassName="flex h-full flex-col">
        <div className={cn('relative aspect-[16/9] overflow-hidden border-b border-line', accentBg[project.accent])}>
          {project.image ? (
            <Image
              src={project.image}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-6xl font-bold opacity-30">
              {project.title.slice(0, 1)}
            </span>
          )}
          <span className="absolute left-3 top-3 rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-fg shadow-cel-sm">
            {project.year}
          </span>
        </div>
        {/* Buton içeriği yalnızca "phrasing" öğelerden oluşur (span) */}
        <span className="block p-4">
          <span className="block text-lg font-bold">{project.title}</span>
          <span className="mt-1 block text-sm text-muted">{project.summary}</span>
          <span className="mt-3 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-fg/5 px-2 py-0.5 text-xs font-semibold text-muted">
                {tag}
              </span>
            ))}
          </span>
        </span>
      </Card>
    </m.button>
  );
}
