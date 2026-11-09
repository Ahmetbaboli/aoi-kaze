interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Site logosu (orijinal): gradyanlı kare içinde, rüzgârın savurduğu "A" harfi.
 * Gradyan ve çizgiler tema renklerinden bağımsızdır; koyu ve açık zeminde aynı görünür.
 */
export default function LogoMark({ size = 36, className }: LogoMarkProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width={size} height={size} className={className} fill="none">
      <defs>
        <linearGradient id="logo-bg" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FB7185" />
          <stop offset="0.55" stopColor="#E11D48" />
          <stop offset="1" stopColor="#9F1239" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#logo-bg)" />
      <path d="M13 36 24 11l11 25" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.5 28.5h13" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" opacity="0.9" />
      <path d="M5 21c7 0 11-4 17-4M3 30c9 0 14-3 21-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}
