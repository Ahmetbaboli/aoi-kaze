// Geliştirme tohumu. Tekrar çalıştırılabilir (upsert): `npm run db:seed`.
//
// Yalnızca açık lisanslı Blender Foundation filmleri ve resmî YouTube kanalı kullanılır.
// Kaynaklar:
//   - youtube      : üç filmin resmî Blender YouTube kimlikleri (doğrulandı)
//   - blender-cdn  : Sintel fragmanı (.mp4, tarayıcıda güvenle oynar)
//   - local        : `npm run media:hls` ile ürettiğin yerel HLS (public/media/<slug>/master.m3u8).
//                    Dosya yoksa bu kaynak eklenmez; sonradan üretip seed'i yeniden çalıştırman yeterli.
// Tears of Steel .mov dosyası tarayıcılarda güvenilir oynamadığı için bilerek eklenmez.
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const prisma = new PrismaClient();

const providers = [
  { key: 'youtube', name: 'YouTube (resmî kanallar)', licensed: true },
  { key: 'blender-cdn', name: 'Blender Foundation CDN (açık lisans)', licensed: true },
  // Yerel HLS yalnızca scripts/make-hls.mjs'in ürettiği Blender açık filmleri içindir. "licensed" işareti bu
  // varsayıma dayanır: public/media altına başka (lisansı belirsiz) içerik koyma.
  { key: 'local', name: 'Yerel HLS (Blender açık filmleri)', licensed: true },
];

const films = [
  {
    slug: 'big-buck-bunny',
    title: 'Big Buck Bunny',
    synopsisEn: 'A giant rabbit takes revenge on three bullying rodents. Open movie by the Blender Foundation (CC BY 3.0).',
    synopsisTr: 'Dev bir tavşan, kendisini rahatsız eden üç kemiriciden intikam alır. Blender Foundation açık filmi (CC BY 3.0).',
    maxQuality: '4K',
    sources: [{ provider: 'youtube', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', quality: '4K' }],
  },
  {
    slug: 'sintel',
    title: 'Sintel',
    synopsis: null,
    synopsisEn: 'A young woman searches for the baby dragon she befriended. Open movie by the Blender Foundation (CC BY 3.0).',
    synopsisTr: 'Genç bir kadın, dost olduğu yavru ejderhayı arar. Blender Foundation açık filmi (CC BY 3.0).',
    maxQuality: '4K',
    sources: [
      { provider: 'youtube', url: 'https://www.youtube.com/watch?v=eRsGyueVLvQ', quality: '1080p' },
      { provider: 'blender-cdn', url: 'https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4', quality: '480p' },
    ],
  },
  {
    slug: 'tears-of-steel',
    title: 'Tears of Steel',
    synopsis: null,
    synopsisEn: 'Warriors and scientists try to save the world from destructive robots. Open movie by the Blender Foundation (CC BY 3.0).',
    synopsisTr: 'Savaşçılar ve bilim insanları dünyayı yıkıcı robotlardan kurtarmaya çalışır. Blender Foundation açık filmi (CC BY 3.0).',
    maxQuality: '4K',
    sources: [
      { provider: 'youtube', url: 'https://www.youtube.com/watch?v=R6MlUcmOul8', quality: '1080p' },
    ],
  },
];

async function main() {
  const providerIds = {};
  for (const provider of providers) {
    const row = await prisma.providerConfig.upsert({
      where: { key: provider.key },
      update: { name: provider.name, licensed: provider.licensed },
      create: provider,
    });
    providerIds[provider.key] = row.id;
  }

  for (const film of films) {
    const anime = await prisma.anime.upsert({
      where: { slug: film.slug },
      update: { title: film.title, synopsisEn: film.synopsisEn, synopsisTr: film.synopsisTr, maxQuality: film.maxQuality },
      create: {
        slug: film.slug,
        title: film.title,
        synopsisEn: film.synopsisEn,
        synopsisTr: film.synopsisTr,
        maxQuality: film.maxQuality,
        featured: true,
      },
    });

    const episode = await prisma.episode.upsert({
      where: { animeId_number: { animeId: anime.id, number: 1 } },
      update: {},
      create: { animeId: anime.id, number: 1, title: film.title },
    });

    // Eski seed sürümünde eklenmiş .mov kaynağı varsa kaldır (tarayıcılarda güvenilir oynamaz).
    await prisma.episodeSource.deleteMany({
      where: { episodeId: episode.id, url: 'https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov' },
    });

    const hlsPath = join(root, 'public', 'media', film.slug, 'master.m3u8');
    const sources = existsSync(hlsPath)
      ? [...film.sources, { provider: 'local', url: `/media/${film.slug}/master.m3u8`, quality: '720p' }]
      : film.sources;
    if (!existsSync(hlsPath)) console.log(`  (${film.slug}: yerel HLS yok, atlandı — npm run media:hls)`);

    for (const source of sources) {
      const providerId = providerIds[source.provider];
      const existing = await prisma.episodeSource.findFirst({ where: { episodeId: episode.id, providerId, url: source.url } });
      if (!existing) {
        await prisma.episodeSource.create({
          data: { episodeId: episode.id, providerId, type: 'SUB', quality: source.quality, url: source.url },
        });
      }
    }
  }

  const counts = {
    providers: await prisma.providerConfig.count(),
    anime: await prisma.anime.count(),
    episodes: await prisma.episode.count(),
    sources: await prisma.episodeSource.count(),
  };
  console.log('Seed tamam:', counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
