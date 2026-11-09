#!/usr/bin/env node
// Docker olmadan veritabanı doğrulaması: `npm run db:verify`
//
// Bellekte bir PostgreSQL (PGlite) başlatır, pglite-socket ile rastgele bir yerel porta açar ve gerçek
// Prisma komutlarını ona karşı çalıştırır:
//   1) prisma migrate deploy       (migration + tetikleyiciler + CHECK kısıtları)
//   2) prisma/seed.mjs, iki kez    (idempotent mi?)
//   3) sayım doğrulaması, lisans tetikleyicisinin Prisma Client üzerinden testi
// Hata varsa çıkış kodu 1'dir. Kalıcı hiçbir veri yazmaz.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prismaBin = join(root, 'node_modules', 'prisma', 'build', 'index.js');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

/**
 * Bir Node betiğini verilen DATABASE_URL ile çalıştırır; çıktıyı toplar.
 * PGlite tek oturumludur: bir Prisma sürecinin hazırladığı sorgular (s0, s1…) süreç kapandıktan sonra da
 * oturumda kalır ve bir sonraki süreç aynı adı kullanınca "prepared statement already exists" hatası verir.
 * Bu bir test düzeneği sınırlamasıdır (gerçek PostgreSQL her bağlantıya ayrı oturum verir), bu yüzden
 * her süreçten önce hazırlanmış sorgular temizlenir.
 */
async function runNode(args, databaseUrl, db) {
  await db.exec('DEALLOCATE ALL');
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    child.on('close', (code) => resolveRun({ code, output }));
  });
}

const tail = (text, lines = 12) => text.trim().split('\n').slice(-lines).join('\n');

async function main() {
  const port = await freePort();
  const db = await PGlite.create();
  // Prisma bağlantı havuzu birden çok bağlantı açar; sunucu bunları sorgu düzeyinde sıraya koyar.
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  console.log(`PGlite hazır: 127.0.0.1:${port} (bellekte)\n`);

  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1&pool_timeout=30`;
  let prisma;

  try {
    // 1) Migration
    const migrate = await runNode([prismaBin, 'migrate', 'deploy'], databaseUrl, db);
    check('prisma migrate deploy', migrate.code === 0, migrate.code === 0 ? '' : `\n${tail(migrate.output)}`);
    if (migrate.code !== 0) return;

    // 2) Seed, iki kez
    const seeds = [];
    for (const round of [1, 2]) {
      const run = await runNode(['prisma/seed.mjs'], databaseUrl, db);
      check(`seed (${round}. çalıştırma)`, run.code === 0, run.code === 0 ? '' : `\n${tail(run.output)}`);
      if (run.code !== 0) return;
      seeds.push(run.output);
    }

    // 3) Sayımlar (bu süreç de kendi hazırlanmış sorgularını açacak: önce temizle)
    await db.exec('DEALLOCATE ALL');
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    const count = async () => ({
      providers: await prisma.providerConfig.count(),
      anime: await prisma.anime.count(),
      episodes: await prisma.episode.count(),
      sources: await prisma.episodeSource.count(),
    });
    const counts = await count();

    // Beklenen kaynak sayısı: 3 YouTube + 1 Sintel fragmanı + yerel HLS'i olan her film için 1
    const localFilms = ['big-buck-bunny', 'sintel', 'tears-of-steel'].filter((slug) => existsSync(join(root, 'public', 'media', slug, 'master.m3u8')));
    const expected = { providers: 3, anime: 3, episodes: 3, sources: 4 + localFilms.length };
    for (const key of Object.keys(expected)) {
      check(`${key} = ${expected[key]}`, counts[key] === expected[key], `bulunan: ${counts[key]}`);
    }
    console.log(`   (yerel HLS olan film sayısı: ${localFilms.length})`);

    const keys = (await prisma.providerConfig.findMany({ select: { key: true } })).map((p) => p.key).sort();
    check('sağlayıcılar: blender-cdn, local, youtube', keys.join(',') === 'blender-cdn,local,youtube', keys.join(','));
    const unlicensed = await prisma.providerConfig.count({ where: { licensed: false } });
    check('tohumdaki tüm sağlayıcılar licensed=true', unlicensed === 0);
    const movLeft = await prisma.episodeSource.count({ where: { url: { endsWith: '.mov' } } });
    check('.mov kaynağı yok (Tears of Steel)', movLeft === 0);

    // Idempotency: ikinci çalıştırma sayıları değiştirmemeli (ilk çalıştırma sonrası sayım = son sayım)
    const secondSummary = seeds[1].match(/Seed tamam: (\{[^}]*\})/)?.[1] ?? '';
    check('ikinci seed aynı sayıları verdi', secondSummary.includes(`sources: ${expected.sources}`) && secondSummary.includes('anime: 3'), secondSummary.replace(/\s+/g, ' '));

    // 4) Lisans tetikleyicisi, Prisma Client üzerinden
    const bad = await prisma.providerConfig.create({ data: { key: 'verify-unlicensed', name: 'Lisanssız (test)', licensed: false } });
    const episode = await prisma.episode.findFirstOrThrow();
    let blocked = false;
    let message = '';
    try {
      await prisma.episodeSource.create({ data: { episodeId: episode.id, providerId: bad.id, type: 'SUB', url: 'https://example.invalid/x.m3u8' } });
    } catch (error) {
      blocked = true;
      message = String(error.message).split('\n').filter(Boolean).pop() ?? '';
    }
    check('licensed=false sağlayıcıya EpisodeSource bağlanamıyor', blocked, message);
    const sourcesAfter = await prisma.episodeSource.count();
    check('engellenen kaynak veritabanına yazılmadı', sourcesAfter === expected.sources, `kaynak sayısı: ${sourcesAfter}`);

    // Lisans bayrağı kaldırma koruması: lisanslı bir sağlayıcıyı kaynaklıyken lisanssıza çevirme
    const youtube = await prisma.providerConfig.findUniqueOrThrow({ where: { key: 'youtube' } });
    let protectedFlag = false;
    try {
      await prisma.providerConfig.update({ where: { id: youtube.id }, data: { licensed: false } });
    } catch {
      protectedFlag = true;
    }
    check('kaynaklı sağlayıcının lisansı kaldırılamıyor', protectedFlag);

    // Temizlik: test sağlayıcısını sil
    await prisma.providerConfig.delete({ where: { id: bad.id } });
  } finally {
    if (prisma) await prisma.$disconnect();
    await server.stop();
    await db.close();
  }
}

main()
  .catch((error) => {
    check('doğrulama betiği çöktü', false, error.stack ?? String(error));
  })
  .finally(() => {
    console.log(failures === 0 ? '\nTÜM KONTROLLER GEÇTİ' : `\n${failures} KONTROL BAŞARISIZ`);
    process.exit(failures === 0 ? 0 : 1);
  });
