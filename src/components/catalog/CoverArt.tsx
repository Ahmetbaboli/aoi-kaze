import Image from 'next/image';
import type { MediaSummary } from '@/lib/catalog/types';

type CoverSource = Pick<MediaSummary, 'cover' | 'color' | 'title'> & { titleNative?: string | null };

interface CoverArtProps {
  media: CoverSource;
  sizes: string;
  priority?: boolean;
}

/** "Başlık: alt başlık" biçimindeki adı logo gibi iki satıra böler. */
function wordmark(title: string): { main: string; sub: string | null } {
  const [first, ...rest] = title.split(/:\s+/);
  const words = first.split(' ');
  if (rest.length === 0 && words.length > 2) {
    const mid = Math.ceil(words.length / 2);
    return { main: words.slice(0, mid).join(' '), sub: words.slice(mid).join(' ') };
  }
  return { main: first, sub: rest.join(': ') || null };
}

/**
 * Kapak görseli. Kaynakta görsel yoksa eserin rengiyle üretilmiş tipografik bir poster çizilir:
 * dikey Japonca başlık, logo benzeri ad ve ışık hüzmesi (telifli görsel kullanılmaz).
 */
export default function CoverArt({ media, sizes, priority }: CoverArtProps) {
  if (media.cover) {
    return <Image src={media.cover} alt="" fill sizes={sizes} priority={priority} className="object-cover" />;
  }

  const color = media.color ?? '#475569';
  const { main, sub } = wordmark(media.title);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden text-white"
      style={{ background: `linear-gradient(160deg, ${color} 0%, #0A0A10 115%)` }}
    >
      <div className="absolute -right-1/4 -top-1/4 h-3/4 w-3/4 rounded-full opacity-40 blur-2xl" style={{ background: `radial-gradient(${color}, transparent 70%)` }} />
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 14px)' }} />
      {media.titleNative && (
        <span
          lang="ja"
          className="absolute right-3 top-4 max-h-[70%] overflow-hidden text-xl font-extrabold leading-tight tracking-widest opacity-40 [text-orientation:upright] [writing-mode:vertical-rl]"
        >
          {media.titleNative.replace(/[\s;:!?]/g, '').slice(0, 10)}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-12">
        <p className="line-clamp-3 text-xl font-black uppercase leading-[1.05] tracking-tight drop-shadow sm:text-2xl">{main}</p>
        {sub && <p className="mt-1 line-clamp-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/80">{sub}</p>}
      </div>
    </div>
  );
}
