import LogoMark from './LogoMark';

/** Logo + yazı: "AOI" beyaz/koyu, "KAZE" vurgu renginde; altında küçük Japonca imza. */
export default function Wordmark({ name, size = 34 }: { name: string; size?: number }) {
  const [first, ...rest] = name.split(' ');
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl tracking-tight">
          {first}
          {rest.length > 0 && <span className="ml-1 text-primary-text">{rest.join(' ')}</span>}
        </span>
        <span aria-hidden="true" lang="ja" className="mt-1 text-[0.6rem] font-semibold tracking-[0.35em] text-muted">
          青い風
        </span>
      </span>
    </span>
  );
}
