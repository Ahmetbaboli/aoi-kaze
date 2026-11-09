import type { ReactNode } from 'react';

/** Sayfa geçişlerinde içerik kısa bir solma ve yükselmeyle gelir (CSS animasyonu). */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="anim-page">{children}</div>;
}
