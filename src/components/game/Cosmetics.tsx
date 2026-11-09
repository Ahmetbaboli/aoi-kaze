import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const FRAME_CLASS: Record<string, string> = { frame_gold: 'frame-gold', frame_silver: 'frame-silver', frame_bronze: 'frame-bronze' };
const NAME_CLASS: Record<string, string> = { name_gradient: 'name-gradient', name_color: 'name-color' };

/** Takılı çerçeveyle avatar. Çerçeve yoksa düz yuvarlak avatar. */
export function FramedAvatar({ src, fallback, frame, size, className }: { src: string | null; fallback: string; frame?: string | null; size: number; className?: string }) {
  const inner = (
    <span className="relative block overflow-hidden rounded-full bg-primary" style={{ width: size, height: size }}>
      {src ? (
        <Image src={src} alt="" fill sizes={`${size}px`} unoptimized className="object-cover" />
      ) : (
        <span aria-hidden="true" className="flex h-full w-full items-center justify-center font-bold text-white" style={{ fontSize: size * 0.4 }}>
          {fallback.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
  const frameClass = frame ? FRAME_CLASS[frame] : undefined;
  return frameClass ? <span className={cn('inline-block shrink-0', frameClass, className)}>{inner}</span> : <span className={cn('inline-block shrink-0', className)}>{inner}</span>;
}

/** Takılı isim stiliyle kullanıcı adı. */
export function StyledName({ children, nameStyle, className }: { children: ReactNode; nameStyle?: string | null; className?: string }) {
  return <span className={cn(nameStyle ? NAME_CLASS[nameStyle] : undefined, className)}>{children}</span>;
}

/** Takılı unvan rozeti (ör. "Sezon Şampiyonu"). */
export function TitleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-amber-400 to-pink-500 px-2 py-0.5 text-xs font-bold text-white">
      <span aria-hidden="true">🏆</span>
      {label}
    </span>
  );
}
