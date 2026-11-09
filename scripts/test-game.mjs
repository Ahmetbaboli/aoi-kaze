#!/usr/bin/env node
// Mini oyun testi: `npm run test:game`
//   - saf kurallar: gün/sezon sınırları (Türkiye saati), puan, ipucu açılması, ödül kademeleri (src/lib/game/game-logic.ts)
//   - veritabanı: günlük bulmaca seçimi, tahmin doğrulama, hile koruması, seri, sıralama, sezon ödülleri, kozmetik takma
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (file) => import(pathToFileURL(join(root, 'src', 'lib', file)).href);
const logic = await load('game/game-logic.ts');
const core = await load('game/game-core.ts');

let failures = 0;
let total = 0;
const check = (name, ok, detail = '') => {
  total++;
  console.log(`${ok ? '✅' : '❌'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const eq = (name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), `beklenen ${JSON.stringify(expected)}, bulunan ${JSON.stringify(actual)}`);
const section = (title) => console.log(`\n— ${title}`);

/* =============================== Saf kurallar =============================== */

section('Gün ve sezon (Türkiye saati)');
eq('TR 23:59 hâlâ aynı gün', logic.dayKey(new Date('2026-11-09T20:59:00Z')), '2026-11-09');
eq('TR 00:00 yeni gün', logic.dayKey(new Date('2026-11-09T21:00:00Z')), '2026-11-10');
eq('önceki gün (ay/yıl geçişi)', [logic.previousDay('2026-03-01'), logic.previousDay('2027-01-01')], ['2026-02-28', '2026-12-31']);
eq('ISO haftaları', ['2026-01-01', '2021-01-03', '2026-11-09', '2026-12-28', '2027-01-04', '2024-12-30'].map((d) => logic.seasonKey(new Date(`${d}T12:00:00Z`))), ['2026-W01', '2020-W53', '2026-W46', '2026-W53', '2027-W01', '2025-W01']);
eq('sezon pazar gecesi TR 00:00’da değişir', [logic.seasonKey(new Date('2026-11-15T20:59:00Z')), logic.seasonKey(new Date('2026-11-15T21:00:00Z'))], ['2026-W46', '2026-W47']);
eq('sonraki bulmaca: TR gece yarısı', logic.nextPuzzleAt(new Date('2026-11-09T12:00:00Z')).toISOString(), '2026-11-09T21:00:00.000Z');
eq('sezon bitişi: pazartesi TR 00:00', logic.seasonEndsAt(new Date('2026-11-11T12:00:00Z')).toISOString(), '2026-11-15T21:00:00.000Z');

section('Puan ve ipuçları');
eq('taban puanlar', [1, 2, 3, 4, 5, 6].map((n) => logic.scoreFor(n, 1)), [100, 80, 60, 45, 30, 15]);
eq('seri bonusu 2. günden, en fazla +50', [logic.scoreFor(1, 2), logic.scoreFor(1, 11), logic.scoreFor(1, 99)], [105, 150, 150]);
eq('geçersiz deneme 0 puan', [logic.scoreFor(0, 1), logic.scoreFor(7, 1)], [0, 0]);
eq('ipucu sayısı', [logic.revealedClueCount(0, false), logic.revealedClueCount(3, false), logic.revealedClueCount(9, false), logic.revealedClueCount(0, true)], [1, 4, 6, 6]);
eq('ödül kademeleri', [1, 3, 4, 10, 11, 50, 51, 0].map((r) => logic.rewardsForRank(r).length), [3, 3, 2, 2, 1, 1, 0, 0]);
eq('paylaşım metni ipucu vermez', logic.shareText('AK', '2026-11-09', 3, true), 'AK 2026-11-09 · 3/6 🟥🟥🟩');

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

/** Sahte AniList: her sayfada 5 aday (kimlik = sayfa·100 + sıra). */
let sourceCalls = 0;
const source = async (page) => {
  sourceCalls++;
  return Array.from({ length: 5 }, (_, i) => {
    const id = page * 100 + i;
    return {
      answer: { id, title: `Anime ${id}`, titleNative: null, cover: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx${id}.jpg`, color: '#123456' },
      clues: { basics: { format: 'TV', year: 2000 + i, episodes: 12 }, genres: ['Action'], studio: 'Studio X', tags: ['Tag'], cover: 'c', character: 'Hero' },
    };
  });
};
const SECRET = 'test-secret';
const day = (d, h = 12) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00Z`);

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
    const mk = (n, extra = {}) => prisma.user.create({ data: { email: `${n}@example.com`, username: n, ...extra } });
    const [ali, ayse, gizli] = [await mk('ali'), await mk('ayse'), await mk('gizli', { profilePublic: false })];

    section('Günlük bulmaca');
    const p1 = await core.getOrCreatePuzzle(prisma, '2026-11-09', source, SECRET);
    const p1again = await core.getOrCreatePuzzle(prisma, '2026-11-09', source, SECRET);
    eq('aynı gün aynı bulmaca', p1again.id, p1.id);
    const [c1, c2] = await Promise.all(['2026-11-10', '2026-11-10'].map((d) => core.getOrCreatePuzzle(prisma, d, source, SECRET)));
    eq('aynı anda iki istek tek bulmaca üretir', c1.id, c2.id);
    const days = Array.from({ length: 20 }, (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`);
    const picked = [];
    for (const d of days) picked.push((await core.getOrCreatePuzzle(prisma, d, source, SECRET)).mediaId);
    eq('365 gün içinde tekrar yok', new Set(picked).size, picked.length);
    check('farklı anahtar farklı sıra üretir', core.seededNumber('a', '2026-11-09') !== core.seededNumber('b', '2026-11-09'));

    section('Durum ve gizlilik');
    const now = day('2026-11-09');
    let st = await core.getPlayState(prisma, ali.id, now, source, SECRET);
    eq('başta yalnızca 1. ipucu açık', st.revealed, ['basics']);
    check('cevap gönderilmez', st.answer === null && !JSON.stringify(st).includes(`Anime ${p1.mediaId}`));
    check('açılmamış ipuçları gönderilmez', st.clues.cover === undefined && st.clues.character === undefined);

    section('Tahminler');
    const answer = p1.mediaId;
    const wrong = [1, 2, 3, 4, 5, 6].map((n) => 900000 + n);
    eq('girişsiz tahmin', (await core.submitGuess(prisma, null, wrong[0], now, source, SECRET)).error, 'unauthorized');
    eq('geçersiz kimlik', (await core.submitGuess(prisma, ali.id, 'x', now, source, SECRET)).error, 'invalid');
    let r = await core.submitGuess(prisma, ali.id, wrong[0], now, source, SECRET);
    eq('yanlış tahmin 2. ipucunu açar', [r.ok, r.state.revealed.length, r.state.finished], [true, 2, false]);
    eq('aynı tahmin tekrar sayılmaz', (await core.submitGuess(prisma, ali.id, wrong[0], now, source, SECRET)).error, 'duplicate');
    r = await core.submitGuess(prisma, ali.id, answer, now, source, SECRET);
    eq('2. tahminde doğru → 80 puan, seri 1, cevap açılır', [r.state.solved, r.state.score, r.state.streak, r.state.answer?.id], [true, 80, 1, answer]);
    eq('bitmiş oyuna tahmin yok', (await core.submitGuess(prisma, ali.id, wrong[1], now, source, SECRET)).error, 'finished');

    const race = await Promise.all([wrong[2], wrong[3]].map((g) => core.submitGuess(prisma, ayse.id, g, now, source, SECRET)));
    const raceRow = await prisma.gamePlay.findFirst({ where: { userId: ayse.id } });
    check('aynı anda iki tahmin: kayıp tahmin olmaz, liste tutarlı', raceRow.guesses.length === race.filter((x) => x.ok).length, JSON.stringify(race.map((x) => x.error ?? 'ok')));
    for (const g of wrong) if (!raceRow.guesses.includes(g)) await core.submitGuess(prisma, ayse.id, g, now, source, SECRET);
    st = await core.getPlayState(prisma, ayse.id, now, source, SECRET);
    eq('6 yanlışta oyun biter, 0 puan, cevap gösterilir', [st.finished, st.solved, st.score, st.guesses.length, !!st.answer], [true, false, 0, 6, true]);

    section('Seri');
    const tomorrow = day('2026-11-10');
    const p2 = await core.getOrCreatePuzzle(prisma, '2026-11-10', source, SECRET);
    r = await core.submitGuess(prisma, ali.id, p2.mediaId, tomorrow, source, SECRET);
    eq('ertesi gün 1. tahminde: 100 + 5 seri bonusu', [r.state.streak, r.state.score], [2, 105]);
    const p3 = await core.getOrCreatePuzzle(prisma, '2026-11-12', source, SECRET);
    r = await core.submitGuess(prisma, ali.id, p3.mediaId, day('2026-11-12'), source, SECRET);
    eq('bir gün atlanınca seri sıfırlanır', [r.state.streak, r.state.score], [1, 100]);

    section('Sıralama');
    await core.submitGuess(prisma, gizli.id, p2.mediaId, tomorrow, source, SECRET);
    const board = await core.getLeaderboard(prisma, '2026-W46');
    eq('puana göre sıralı, 0 puanlı oyuncu yok', board.map((b) => [b.rank, b.score]), [[1, 285], [2, 100]]);
    eq('gizli profil adıyla gösterilmez', [board[1].hidden, board[1].username], [true, null]);
    eq('kullanıcı sırası', await core.getUserRank(prisma, '2026-W46', ali.id), { rank: 1, score: 285 });

    section('Sezon ödülleri');
    eq('süren sezon ödüllendirilmez', await core.awardPendingSeasons(prisma, day('2026-11-12')), []);
    const next = day('2026-11-17');
    eq('sezon bitince ödüllendirilir', await core.awardPendingSeasons(prisma, next), ['2026-W46']);
    eq('ikinci çağrı tekrar vermez', await core.awardPendingSeasons(prisma, next), []);
    const aliRewards = (await core.getRewards(prisma, ali.id)).map((x) => x.item).sort();
    eq('1. olan altın paketi alır', aliRewards, ['frame_gold', 'name_gradient', 'title_champion']);
    eq('ödül sayısı (1. ve 2. sıra)', await prisma.gameReward.count(), 6);

    section('Kozmetik takma');
    eq('sahip olunan çerçeve takılır', await core.equipItem(prisma, ali.id, 'frame', 'frame_gold'), { ok: true });
    eq('sahip olunmayan takılamaz', (await core.equipItem(prisma, ali.id, 'frame', 'frame_silver')).ok, false);
    eq('yanlış yuvaya takılamaz', (await core.equipItem(prisma, ali.id, 'name', 'frame_gold')).ok, false);
    eq('ödülü olmayan kullanıcı takamaz', (await core.equipItem(prisma, ayse.id, 'frame', 'frame_gold')).ok, false);
    eq('veritabanına yazıldı', (await prisma.user.findUnique({ where: { id: ali.id } })).equippedFrame, 'frame_gold');
    eq('çıkarma', [(await core.equipItem(prisma, ali.id, 'frame', null)).ok, (await prisma.user.findUnique({ where: { id: ali.id } })).equippedFrame], [true, null]);

    section('Veritabanı kısıtları');
    let blocked = false;
    try {
      await prisma.gamePlay.update({ where: { userId_puzzleId: { userId: ayse.id, puzzleId: p1.id } }, data: { score: -5 } });
    } catch {
      blocked = true;
    }
    check('negatif puan veritabanında reddedilir', blocked);
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
