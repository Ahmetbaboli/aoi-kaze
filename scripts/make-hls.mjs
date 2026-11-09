#!/usr/bin/env node
// Blender açık filmlerinden (Big Buck Bunny, Sintel, Tears of Steel) yerel HLS üretir.
//
//   npm run media:hls                     # üç filmi de indirir ve dönüştürür
//   npm run media:hls -- --only sintel    # yalnızca biri
//   npm run media:hls -- --short 60       # her filmin yalnızca ilk 60 saniyesi (hızlı deneme)
//   npm run media:hls -- --force          # var olan çıktıyı yeniden üret
//
// Gereksinim: ffmpeg (https://ffmpeg.org) PATH üzerinde olmalı.
// Çıktı:  public/media/<slug>/master.m3u8  (+ 720p/ ve 480p/ altında segmentler) — .gitignore'dadır.
// İndirilen kaynak dosyalar media-src/ altında önbelleğe alınır (o da .gitignore'dadır).
//
// Filmler Blender Foundation'a aittir ve Creative Commons Attribution 3.0 altında yayımlanır;
// her çıktı klasörüne bir LICENSE.txt (atıf) yazılır. Başka içerik dönüştürmek için kullanma:
// seed, public/media altındaki dosyaları "lisanslı" kabul eder.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import JSZip from 'jszip';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'media-src');
const outRoot = join(root, 'public', 'media');

/** Kaynak adresleri blender.org dizin listelerinden doğrulanmıştır. `zipEntry`: zip içindeki video dosyası. */
const FILMS = [
  {
    slug: 'big-buck-bunny',
    title: 'Big Buck Bunny',
    year: 2008,
    url: 'https://download.blender.org/peach/bigbuckbunny_movies/big_buck_bunny_720p_h264.mov.zip',
    zipped: true,
  },
  {
    slug: 'sintel',
    title: 'Sintel',
    year: 2010,
    url: 'https://download.blender.org/durian/movies/Sintel.2010.720p.mkv.zip',
    zipped: true,
  },
  {
    slug: 'tears-of-steel',
    title: 'Tears of Steel',
    year: 2012,
    url: 'https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov',
    zipped: false,
  },
];

/** Her çözünürlük için video yüksekliği ve hedef bit hızı (kbps). */
const RENDITIONS = [
  { name: '720p', height: 720, videoKbps: 2800, audioKbps: 128 },
  { name: '480p', height: 480, videoKbps: 1200, audioKbps: 96 },
];

/* ------------------------------ Yardımcılar ------------------------------ */

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const only = option('only');
const shortSeconds = option('short') ? Number(option('short')) : null;
const force = flag('force');

function fail(message) {
  console.error(`\nHata: ${message}`);
  process.exit(1);
}

function assertFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    fail(
      'ffmpeg bulunamadı. Kur ve PATH\'e ekle:\n' +
        '  Windows : winget install Gyan.FFmpeg   (ya da https://www.gyan.dev/ffmpeg/builds/)\n' +
        '  macOS   : brew install ffmpeg\n' +
        '  Linux   : sudo apt install ffmpeg',
    );
  }
  console.log(result.stdout.split('\n')[0]);
}

async function download(url, target) {
  console.log(`  indiriliyor: ${url}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`İndirilemedi (${response.status}): ${url}`);
  const total = Number(response.headers.get('content-length')) || 0;
  let received = 0;
  let lastLog = 0;
  const body = Readable.fromWeb(response.body);
  body.on('data', (chunk) => {
    received += chunk.length;
    if (total && received - lastLog > total / 20) {
      lastLog = received;
      process.stdout.write(`\r  ${Math.round((received / total) * 100)}% (${(received / 1e6).toFixed(0)} / ${(total / 1e6).toFixed(0)} MB)   `);
    }
  });
  await pipeline(body, createWriteStream(target));
  process.stdout.write('\n');
}

async function ensureSource(film) {
  await mkdir(srcDir, { recursive: true });
  const ext = film.zipped ? '.zip' : film.url.slice(film.url.lastIndexOf('.'));
  const archive = join(srcDir, `${film.slug}${ext}`);
  if (!existsSync(archive)) {
    const partial = `${archive}.part`;
    await download(film.url, partial);
    await rm(archive, { force: true });
    await import('node:fs/promises').then((fs) => fs.rename(partial, archive));
  } else {
    console.log(`  önbellekte: ${archive}`);
  }
  if (!film.zipped) return archive;

  const videoPath = join(srcDir, `${film.slug}.video`);
  if (existsSync(videoPath)) return videoPath;
  console.log('  zip açılıyor…');
  const zip = await JSZip.loadAsync(await readFile(archive));
  const entry = Object.values(zip.files).find((file) => !file.dir && /\.(mov|mkv|mp4|avi)$/i.test(file.name));
  if (!entry) throw new Error(`Zip içinde video dosyası bulunamadı: ${archive}`);
  await writeFile(videoPath, await entry.async('nodebuffer'));
  return videoPath;
}

function runFfmpeg(ffmpegArgs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-stats', '-y', ...ffmpegArgs], { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolvePromise() : reject(new Error(`ffmpeg ${code} koduyla çıktı`))));
  });
}

async function encode(input, outDir, rendition) {
  const dir = join(outDir, rendition.name);
  await mkdir(dir, { recursive: true });
  console.log(`  ${rendition.name} üretiliyor…`);
  await runFfmpeg([
    ...(shortSeconds ? ['-t', String(shortSeconds)] : []),
    '-i', input,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', `scale=-2:${rendition.height}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-b:v', `${rendition.videoKbps}k`, '-maxrate', `${Math.round(rendition.videoKbps * 1.1)}k`, '-bufsize', `${rendition.videoKbps * 2}k`,
    // Çözünürlükler arasında hizalı segmentler: sabit GOP, sahne kesmede ekstra anahtar kare yok.
    '-g', '144', '-keyint_min', '144', '-sc_threshold', '0',
    '-c:a', 'aac', '-b:a', `${rendition.audioKbps}k`, '-ac', '2',
    '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
    '-hls_segment_filename', join(dir, 'seg_%04d.ts'),
    join(dir, 'index.m3u8'),
  ]);
}

/** Çözünürlükleri birleştiren ana (master) oynatma listesi. */
function masterPlaylist(widthByRendition) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const r of RENDITIONS) {
    const bandwidth = (r.videoKbps + r.audioKbps) * 1000;
    const width = widthByRendition[r.name];
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${r.height},CODECS="avc1.4d401f,mp4a.40.2",NAME="${r.name}"`);
    lines.push(`${r.name}/index.m3u8`);
  }
  return lines.join('\n') + '\n';
}

/** ffprobe ile kaynağın en-boy oranından 16:9 dışı filmler için doğru genişliği hesapla (çift sayıya yuvarla). */
function probeAspect(input) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', input], { encoding: 'utf8' });
  const [w, h] = (result.stdout ?? '').trim().split(',').map(Number);
  return w && h ? w / h : 16 / 9;
}

/* ------------------------------ Ana akış ------------------------------ */

async function main() {
  assertFfmpeg();
  const films = only ? FILMS.filter((film) => film.slug === only) : FILMS;
  if (films.length === 0) fail(`Bilinmeyen film: ${only}. Seçenekler: ${FILMS.map((film) => film.slug).join(', ')}`);

  for (const film of films) {
    console.log(`\n▶ ${film.title}`);
    const outDir = join(outRoot, film.slug);
    const master = join(outDir, 'master.m3u8');
    if (existsSync(master) && !force) {
      console.log('  zaten var (yeniden üretmek için --force)');
      continue;
    }

    const input = await ensureSource(film);
    const aspect = probeAspect(input);
    await rm(outDir, { recursive: true, force: true });
    await mkdir(outDir, { recursive: true });

    for (const rendition of RENDITIONS) await encode(input, outDir, rendition);

    const widths = Object.fromEntries(RENDITIONS.map((r) => [r.name, Math.round((r.height * aspect) / 2) * 2]));
    await writeFile(master, masterPlaylist(widths));
    await writeFile(
      join(outDir, 'LICENSE.txt'),
      `${film.title} (${film.year})\n© Blender Foundation | www.blender.org\nLisans: Creative Commons Attribution 3.0 (CC BY 3.0) — https://creativecommons.org/licenses/by/3.0/\nBu klasördeki HLS dosyaları, orijinal filmden yeniden kodlanarak üretilmiştir.\n`,
    );
    console.log(`  tamam → public/media/${film.slug}/master.m3u8`);
  }

  console.log('\nBitti. Kaynakları veritabanına eklemek için: npm run db:seed');
}

main().catch((error) => fail(error.message));
