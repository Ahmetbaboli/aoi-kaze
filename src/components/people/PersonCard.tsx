import Image from 'next/image';
import Link from '@/components/ui/LocLink';

interface PersonCardProps {
  href: string;
  name: string;
  image: string | null;
  /** Kartın altındaki küçük satır (rol, dil, eser adı) */
  caption?: string | null;
  /** Görsel yoksa kullanılacak renk */
  accent?: string | null;
  sizes?: string;
}

/** Karakter / seslendiren kartı: dikey portre + ad + küçük açıklama. */
export default function PersonCard({ href, name, image, caption, accent, sizes = '(min-width: 1024px) 12vw, (min-width: 640px) 22vw, 45vw' }: PersonCardProps) {
  return (
    <Link href={href} className="group block overflow-hidden rounded-xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-cel-sm">
      <div className="relative aspect-[3/4] bg-night">
        {image ? (
          <Image src={image} alt="" fill sizes={sizes} className="object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center text-4xl font-black text-white/70"
            style={{ background: `linear-gradient(160deg, ${accent ?? '#475569'}, #0A0A10)` }}
          >
            {name.slice(0, 1)}
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-sm font-bold leading-tight group-hover:text-primary-text">{name}</p>
        {caption && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{caption}</p>}
      </div>
    </Link>
  );
}
