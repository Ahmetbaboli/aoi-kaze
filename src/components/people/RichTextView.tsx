'use client';

import { useState } from 'react';
import type { RichText } from '@/lib/catalog/rich-text';
import { cn } from '@/lib/utils';

/** Tek bir spoiler parçası: varsayılan gizli, tıklayınca (ya da Enter/Boşluk ile) açılır. */
function Spoiler({ text, show, hide }: { text: string; show: string; hide: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      title={open ? hide : show}
      className={cn(
        'mx-0.5 inline rounded px-1 text-left align-baseline transition',
        open ? 'bg-fg/10 text-fg' : 'cursor-pointer bg-fg/80 text-transparent hover:bg-fg/70',
      )}
    >
      {open ? text : <span aria-hidden="true">{text.replace(/\S/g, '•').slice(0, 60)}</span>}
      {!open && <span className="sr-only">{show}</span>}
    </button>
  );
}

/** AniList açıklaması: paragraflar düz metin, spoiler blokları gizli düğmeler (HTML basılmaz). */
export default function RichTextView({ text, labels, className }: { text: RichText; labels: { spoilerShow: string; spoilerHide: string }; className?: string }) {
  return (
    <div className={cn('space-y-4 leading-relaxed', className)}>
      {text.map((paragraph, i) => (
        <p key={i}>
          {paragraph.map((segment, j) =>
            segment.kind === 'spoiler' ? <Spoiler key={j} text={segment.text} show={labels.spoilerShow} hide={labels.spoilerHide} /> : <span key={j}>{segment.text}</span>,
          )}
        </p>
      ))}
    </div>
  );
}
