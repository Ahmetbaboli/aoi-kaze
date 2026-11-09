'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';

interface TrailerEmbedProps {
  videoId: string;
  title: string;
  loadLabel: string;
  note: string;
}

/** Fragman, kullanıcı isteyene kadar yüklenmez (performans + gizlilik). Çerezsiz YouTube alanı kullanılır. */
export default function TrailerEmbed({ videoId, title, loadLabel, note }: TrailerEmbedProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-night shadow-cel-sm">
      <div className="relative aspect-video">
        {loaded ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-[#F1F3FA]">
            <Button onClick={() => setLoaded(true)}>
              ▶ {loadLabel}
            </Button>
            <p className="text-sm text-[#F1F3FA]/80">{note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
