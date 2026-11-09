'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import type { Content } from '@/content';
import ProjectCard from './ProjectCard';
import ProjectModal from './ProjectModal';
import TagFilter from './TagFilter';

const ALL = '__all__';


export default function ProjectsView({ content }: { content: Content['projects'] }) {
  const [activeTag, setActiveTag] = useState(ALL);
  const [openId, setOpenId] = useState<string | null>(null);
  const closeModal = useCallback(() => setOpenId(null), []);

  const tags = useMemo(() => Array.from(new Set(content.items.flatMap((p) => p.tags))), [content.items]);
  const visible = activeTag === ALL ? content.items : content.items.filter((p) => p.tags.includes(activeTag));
  const selected = content.items.find((p) => p.id === openId) ?? null;

  return (
    <>
      <TagFilter
        tags={tags}
        active={activeTag}
        allValue={ALL}
        allLabel={content.all}
        groupLabel={content.filterLabel}
        onChange={setActiveTag}
      />

      <m.ul layout className="grid auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {visible.map((project) => (
            <m.li
              key={project.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className="min-h-[16rem]"
            >
              <ProjectCard project={project} openLabel={content.open} onOpen={setOpenId} />
            </m.li>
          ))}
        </AnimatePresence>
      </m.ul>

      <AnimatePresence>
        {selected && (
          <ProjectModal
            key={selected.id}
            project={selected}
            labels={{ close: content.close, yearLabel: content.yearLabel }}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>
    </>
  );
}
