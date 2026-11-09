import { ImageResponse } from 'next/og';

// Edge runtime: @vercel/og'un Node sürümü Windows'ta build sırasında yol hatası veriyor.
export const runtime = 'edge';
export const alt = 'Aoi Kaze - Anime, Manga and Manhwa Guide';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Open Graph paylaşım görseli: yalnızca Latin harfler (varsayılan yazı tipiyle uyumlu).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 90,
          background: 'linear-gradient(135deg, #0A0A10 0%, #1a0b14 60%, #4c0519 130%)',
          color: '#F1F3FA',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              width: 120,
              height: 120,
              borderRadius: 30,
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 84,
              fontWeight: 900,
              background: 'linear-gradient(135deg, #FB7185, #E11D48 55%, #9F1239)',
            }}
          >
            A
          </div>
          <div style={{ display: 'flex', marginLeft: 36, fontSize: 130, fontWeight: 900, letterSpacing: -3 }}>
            AOI <span style={{ marginLeft: 24, color: '#FB7185' }}>KAZE</span>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 40, fontSize: 40, fontWeight: 700, color: '#94A3B8' }}>
          Anime / Manga / Manhwa guide
        </div>
      </div>
    ),
    size,
  );
}
