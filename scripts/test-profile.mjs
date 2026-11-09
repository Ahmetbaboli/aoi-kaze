#!/usr/bin/env node
// Profil ve seviye testi: `npm run test:profile`
//
//   - seviye/XP formülü, istatistikler, rozetler (src/lib/profile/stats.ts)
//   - küfür / +18 filtresi ve kullanıcı adı kuralları (src/lib/profile/moderation.ts)
//   - profil kaydı: benzersizlik, 30 günlük ad değiştirme sınırı, biyografi, görsel seçimi (PGlite + gerçek migration'lar)
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (file) => import(pathToFileURL(join(root, 'src', 'lib', file)).href);
const stats = await load('profile/stats.ts');
const mod = await load('profile/moderation.ts');
const core = await load('profile/profile-core.ts');

let failures = 0;
let total = 0;
const check = (name, ok, detail = '') => {
  total++;
  console.log(`${ok ? '✅' : '❌'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const eq = (name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), `beklenen ${JSON.stringify(expected)}, bulunan ${JSON.stringify(actual)}`);
const section = (title) => console.log(`\n— ${title}`);

/* =============================== Seviye ve istatistik =============================== */

section('Seviye formülü');
eq('0 XP → 1. seviye', stats.levelFromXp(0).level, 1);
eq('99 XP → 1, 100 XP → 2', [stats.levelFromXp(99).level, stats.levelFromXp(100).level], [1, 2]);
eq('8100 XP → 10. seviye', stats.levelFromXp(8100).level, 10);
eq('seviye üst sınırı 100', stats.levelFromXp(1e12).level, stats.MAX_LEVEL);
eq('ilerleme oranı (150 XP: 100→400 arası %16,7)', Math.round(stats.levelFromXp(150).ratio * 1000), 167);
eq('unvanlar', [1, 5, 10, 20, 35, 50, 75].map((l) => stats.levelFromXp(stats.xpForLevel(l)).title), ['rookie', 'curious', 'fan', 'otaku', 'master', 'sensei', 'legend']);

section('Sayılan bölüm (hile sınırı)');
const e = (patch) => ({ kind: 'anime', status: 'current', favorite: false, progress: 0, total: null, genres: [], ...patch });
eq('ilerleme toplamı aşamaz', stats.unitsOf(e({ progress: 999, total: 12 })), 12);
eq('toplam bilinmiyorsa 5000 ile sınırlı', stats.unitsOf(e({ progress: 1e9 })), stats.PROGRESS_CAP);
eq('tamamladım + bilinen toplam → toplamın tamamı', stats.unitsOf(e({ status: 'completed', progress: 3, total: 24 })), 24);
eq('negatif ilerleme 0', stats.unitsOf(e({ progress: -5 })), 0);

section('İstatistik ve rozetler');
const list = [
  e({ status: 'completed', total: 24, genres: ['Action', 'Drama'], favorite: true }),
  e({ status: 'current', progress: 10, total: 25, genres: ['Action'] }),
  e({ kind: 'manga', status: 'completed', total: 100, genres: ['Romance'] }),
  e({ kind: 'manhwa', status: 'dropped', progress: 5, genres: ['Horror'] }),
];
const s = stats.computeStats(list);
eq('bölüm / chapter', [s.episodes, s.chapters], [34, 105]);
eq('XP = 34·10 + 105·4 + 2·50', s.xp, 340 + 420 + 100);
eq('tahmini süre (dk)', s.minutes, 34 * 24);
eq('bırakılanlar tür dağılımına girmez', s.genres.map((g) => g.name), ['Action', 'Drama', 'Romance']);
eq('durum sayıları', s.byStatus, { planned: 0, current: 1, completed: 2, dropped: 1 });
const badge = (id) => s.badges.find((b) => b.id === id);
eq('ilk adım kazanıldı', badge('first_step').earned, true);
eq('100 bölüm rozeti henüz yok, ilerleme 34/100', [badge('episodes_100').earned, badge('episodes_100').value], [false, 34]);
eq('çok yönlü: 2/3 tür tamamlandı', badge('all_rounder').value, 2);
eq('boş liste çökmez', stats.computeStats([]).level.level, 1);

/* =============================== Filtre =============================== */

section('Küfür / +18 filtresi');
for (const t of ['f.u.c.k', 'big_fucker', 's1kt1r', 'siiiktir', 'orospu_cocugu', 'xxx', 'p0rn_lover', 'hentai_fan', 's i k', 'yarrrak', 'aq']) check(`engellenir: ${t}`, mod.containsProfanity(t));
for (const t of ['Kinoshita', 'Habib nefis', 'I am a fan of Yuri on Ice', 'nazik biri', 'Picasso sever', 'my OC art', 'classic anime', 'as a fan', 'Amina', 'shitake', 'grape juice', 'Sussex', 'cumhuriyet', 'otaku_42'])
  check(`masum: ${t}`, !mod.containsProfanity(t));

section('Kullanıcı adı kuralları');
eq('biçim / ayrılmış / küfür', ['ab', 'Ok_Name', '_x', 'a__b', 'admin', 'admin_2', 'aoikaze', 'fuck_it', 'iyi_isim'].map(mod.checkUsername), ['format', 'format', 'format', 'format', 'reserved', 'reserved', 'reserved', 'profanity', null]);

/* =============================== Veritabanı ile =============================== */

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

function migrate(databaseUrl, db) {
  return db.exec('DEALLOCATE ALL').then(
    () =>
      new Promise((resolveRun) => {
        const child = spawn(process.execPath, [join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'], {
          cwd: root,
          env: { ...process.env, DATABASE_URL: databaseUrl },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let output = '';
        child.stdout.on('data', (c) => (output += c));
        child.stderr.on('data', (c) => (output += c));
        child.on('close', (code) => resolveRun({ code, output }));
      }),
  );
}

const IMG = (n) => `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx${n}.jpg`;
const BANNER = (n) => `https://s4.anilist.co/file/anilistcdn/media/anime/banner/${n}.jpg`;
/** Sahte AniList: 1 → kapak+banner, 2 → yalnızca kapak, 3 → +18 (yok), 4 → kötü adres, 9 → servis kapalı. */
const lookup = async (id) =>
  ({ 1: { cover: IMG(1), banner: BANNER(1) }, 2: { cover: IMG(2), banner: null }, 4: { cover: 'https://evil.example/x.jpg', banner: null }, 9: 'unavailable' })[id] ?? null;

async function databaseTests() {
  const port = await freePort();
  const pg = await PGlite.create();
  const server = new PGLiteSocketServer({ db: pg, port, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1&pool_timeout=30`;
  let prisma;

  try {
    const run = await migrate(databaseUrl, pg);
    check('migration uygulandı', run.code === 0, run.output.trim().split('\n').slice(-6).join(' | '));
    if (run.code !== 0) return;

    await pg.exec('DEALLOCATE ALL');
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    const a = await prisma.user.create({ data: { email: 'a@example.com', username: 'aylin', image: 'https://avatars.githubusercontent.com/u/1' } });
    await prisma.user.create({ data: { email: 'b@example.com', username: 'berk' } });
    const T = new Date('2026-11-05T12:00:00Z');
    const base = { username: 'aylin', bio: '', profilePublic: true, avatar: 'keep', banner: 'keep' };
    const save = (patch, now = T) => core.saveProfile(prisma, a.id, { ...base, ...patch }, lookup, now);

    section('Profil kaydı');
    eq('girişsiz → unauthorized', (await core.saveProfile(prisma, null, base, lookup)).form, 'unauthorized');
    eq('değişiklik yok → ok', await save({}), { ok: true, username: 'aylin' });
    eq('alınmış ad (büyük harfle bile)', (await save({ username: 'BERK' })).errors, { username: 'username_taken' });
    eq('küfürlü ad', (await save({ username: 'sik_lord' })).errors, { username: 'username_profanity' });
    eq('ayrılmış ad', (await save({ username: 'admin' })).errors, { username: 'username_reserved' });
    eq('ilk değişiklik serbest', await save({ username: 'aylin_k' }), { ok: true, username: 'aylin_k' });
    const soon = await save({ username: 'aylin_x' }, new Date(T.getTime() + 24 * 3600 * 1000));
    eq('30 gün dolmadan ikinci değişiklik reddedilir', [soon.errors.username, soon.retryAt], ['username_cooldown', T.getTime() + core.USERNAME_COOLDOWN_MS]);
    eq('30 gün sonra serbest', (await save({ username: 'aylin_x' }, new Date(T.getTime() + core.USERNAME_COOLDOWN_MS + 1))).ok, true);
    base.username = 'aylin_x';

    eq('biyografi temizlenir ve kaydedilir', [(await save({ bio: '  Merhaba!\n\n\n\nShōnen sever.\u0000  ' })).ok, (await prisma.user.findUnique({ where: { id: a.id } })).bio], [true, 'Merhaba!\n\nShōnen sever.']);
    eq('200 karakteri aşan biyografi', (await save({ bio: 'a'.repeat(201) })).errors, { bio: 'bio_too_long' });
    eq('küfürlü biyografi', (await save({ bio: 'tam bir orospu' })).errors, { bio: 'bio_profanity' });
    eq('gizli profil kaydedilir', [(await save({ profilePublic: false })).ok, (await prisma.user.findUnique({ where: { id: a.id } })).profilePublic], [true, false]);

    section('Avatar ve banner (yalnızca eser kimliği)');
    await save({ avatar: 1, banner: 1 });
    let row = await prisma.user.findUnique({ where: { id: a.id } });
    eq('görsel adresi sunucuda AniList’ten alınır', [row.avatarUrl, row.bannerUrl], [IMG(1), BANNER(1)]);
    await save({ banner: 2 });
    eq('banner’ı olmayan eserde kapak kullanılır', (await prisma.user.findUnique({ where: { id: a.id } })).bannerUrl, IMG(2));
    eq('+18 / bulunamayan eser reddedilir', (await save({ avatar: 3 })).errors, { avatar: 'image_invalid' });
    eq('AniList dışı adres reddedilir', (await save({ avatar: 4 })).errors, { avatar: 'image_invalid' });
    eq('doğrudan URL gönderilemez', (await save({ avatar: IMG(5) })).errors, { avatar: 'image_invalid' });
    eq('AniList kapalı → unavailable', (await save({ banner: 9 })).errors, { banner: 'image_unavailable' });
    await save({ avatar: 'provider', banner: 'none' });
    row = await prisma.user.findUnique({ where: { id: a.id } });
    eq('sağlayıcı avatarına dönüş, banner kaldırma', [row.avatarUrl, row.bannerUrl], [null, null]);

    section('Profil okuma');
    const anime = await prisma.anime.create({ data: { anilistId: 16498, kind: 'ANIME', slug: 'al-16498', title: 'Attack on Titan', totalUnits: 25, genres: ['Action', 'Drama'] } });
    await prisma.listEntry.create({ data: { userId: a.id, animeId: anime.id, status: 'COMPLETED', favorite: true, progress: 3 } });
    const p = await core.getProfile(prisma, 'AYLIN_X');
    eq('büyük/küçük harf duyarsız bulunur', p?.username, 'aylin_x');
    eq('istatistik veritabanından: 25 bölüm + tamamlama', [p.stats.episodes, p.stats.xp], [25, 25 * 10 + 50]);
    eq('avatar yoksa sağlayıcı avatarı', p.avatar, 'https://avatars.githubusercontent.com/u/1');
    eq('favori vitrini', p.favorites.map((f) => f.title), ['Attack on Titan']);
    eq('olmayan / geçersiz ad → null', [await core.getProfile(prisma, 'yok_boyle'), await core.getProfile(prisma, "a'; drop")], [null, null]);
  } finally {
    if (prisma) await prisma.$disconnect();
    await server.stop();
    await pg.close();
  }
}

try {
  await databaseTests();
} catch (error) {
  check('veritabanı testleri çöktü', false, error?.stack ?? String(error));
}

console.log(failures === 0 ? `\nTÜM KONTROLLER GEÇTİ (${total})` : `\n${failures} / ${total} KONTROL BAŞARISIZ`);
process.exit(failures === 0 ? 0 : 1);
