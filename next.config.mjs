const standalone = process.env.NEXT_OUTPUT === 'standalone';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Docker imajı için küçük, bağımsız çıktı. (Vercel'de gerekmez; Windows'ta yerel build için kapalı.)
  output: standalone ? 'standalone' : undefined,
  experimental: {
    // Blog yazıları çalışma anında dosyadan okunur: standalone çıktıya dahil et.
    outputFileTracingIncludes: { '/**': ['./src/content/blog/**/*'] },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Kapak ve banner görselleri AniList CDN'inden gelir.
    remotePatterns: [{ protocol: 'https', hostname: 's4.anilist.co' }],
  },
};

export default nextConfig;
