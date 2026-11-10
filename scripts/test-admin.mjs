#!/usr/bin/env node
// Yönetim testi: `npm run test:admin`
//   - profil şikâyeti: doğrulama, kendini şikâyet, 24 saat bekleme, günlük sınır
//   - şikâyet kuyruğu ve kullanıcı arama
//   - yönetici işlemleri: ad sıfırlama, biyografi/görsel temizleme, gizleme, yasaklama (oturumlar kapanır), puan silme
//   - hedef kuralları (kendine / başka yöneticiye işlem yok), işlem kaydı, yasaklının profil ve sıralamadan düşmesi
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (file) => import(pathToFileURL(join(root, 'src', 'lib', file)).href);
const mod = await load('admin/moderation-core.ts');
const profile = await load('profile/profile-core.ts');
const game = await load('game/game-core.ts');

let failures = 0;
let total = 0;
const check = (name, ok, detail = '') => {
  total++;
  console.log(`${ok ? '✅' : '❌'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const eq = (name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), `beklenen ${JSON.stringify(expected)}, bulunan ${JSON.stringify(actual)}`);
const section = (title) => console.log(`\n— ${title}`);

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
    const admin = await mk('yonetim_kisi', { role: 'ADMIN' });
    const admin2 = await mk('diger_admin', { role: 'ADMIN' });
    const bad = await mk('kotu_adam', { bio: 'kötü biyografi', avatarUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg', bannerUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/1.jpg' });
    const r1 = await mk('raportor1');
    const r2 = await mk('raportor2');
    const T = new Date('2026-11-10T12:00:00Z');

    section('Profil şikâyeti');
    eq('girişsiz', (await mod.reportUser(prisma, null, { username: 'kotu_adam', reason: 'NAME' }, T)).error, 'unauthorized');
    eq('geçersiz neden', (await mod.reportUser(prisma, r1.id, { username: 'kotu_adam', reason: 'XYZ' }, T)).error, 'invalid_reason');
    eq('olmayan kullanıcı', (await mod.reportUser(prisma, r1.id, { username: 'yok_boyle', reason: 'NAME' }, T)).error, 'not_found');
    eq('kendini şikâyet edemez', (await mod.reportUser(prisma, bad.id, { username: 'kotu_adam', reason: 'NAME' }, T)).error, 'self');
    eq('uzun not', (await mod.reportUser(prisma, r1.id, { username: 'kotu_adam', reason: 'BIO', note: 'x'.repeat(301) }, T)).error, 'note_too_long');
    eq('geçerli şikâyet (büyük harf ad)', await mod.reportUser(prisma, r1.id, { username: 'KOTU_ADAM', reason: 'NAME', note: ' uygunsuz \u0000 ad ' }, T), { ok: true });
    eq('24 saat dolmadan tekrar şikâyet', (await mod.reportUser(prisma, r1.id, { username: 'kotu_adam', reason: 'BIO' }, new Date(T.getTime() + 3600e3))).error, 'cooldown');
    eq('başka kullanıcı şikâyet edebilir', (await mod.reportUser(prisma, r2.id, { username: 'kotu_adam', reason: 'BIO' }, T)).ok, true);
    eq('not temizlenir', (await prisma.report.findFirst({ where: { userId: r1.id } })).note, 'uygunsuz ad');
    for (let i = 0; i < mod.USER_REPORT_DAILY_MAX; i++) {
      const u = await mk(`hedef_${i}`);
      await mod.reportUser(prisma, r2.id, { username: u.username, reason: 'SPAM' }, T);
    }
    eq('günlük şikâyet sınırı', (await mod.reportUser(prisma, r2.id, { username: 'raportor1', reason: 'SPAM' }, T)).error, 'daily_limit');

    section('Kuyruk ve arama');
    const queue = await mod.listReportQueue(prisma);
    eq('en çok şikâyet edilen başta', [queue[0].user.username, queue[0].count, Object.entries(queue[0].reasons).sort()], ['kotu_adam', 2, [['BIO', 1], ['NAME', 1]]]);
    eq('notlar kuyrukta', queue[0].notes.map((n) => n.note), ['uygunsuz ad']);
    const found = await mod.searchUsers(prisma, 'KOTU');
    eq('arama + açık şikâyet sayısı', [found.length, found[0].username, found[0].openReports], [1, 'kotu_adam', 2]);
    const overview = await mod.getAdminOverview(prisma, T);
    // raportor2: kotu_adam (1) + sınır dolana kadar 19 hedef = 20; raportor1: 1 → toplam 21
    eq('özet: açık kullanıcı şikâyeti', overview.openUserReports, 1 + mod.USER_REPORT_DAILY_MAX);

    section('Hedef kuralları');
    eq('kendine işlem yok', (await mod.moderateUser(prisma, admin.id, admin.id, 'ban', { reason: 'x' })).error, 'self');
    eq('başka yöneticiye işlem yok', (await mod.moderateUser(prisma, admin.id, admin2.id, 'clear_bio')).error, 'target_admin');
    eq('bilinmeyen işlem', (await mod.moderateUser(prisma, admin.id, bad.id, 'delete_everything')).error, 'invalid');
    eq('gerekçesiz yasaklama', (await mod.moderateUser(prisma, admin.id, bad.id, 'ban', { reason: '  ' })).error, 'reason_required');

    section('İşlemler');
    const reset = await mod.moderateUser(prisma, admin.id, bad.id, 'reset_username', { resolveReports: true }, T);
    let row = await prisma.user.findUnique({ where: { id: bad.id } });
    check('ad nötr bir adla değişti', /^uye_[0-9a-f]{8}$/.test(row.username), row.username);
    eq('ad değiştirme beklemesi sıfırlandı, şikâyetler kapandı', [row.usernameChangedAt, reset.details.resolvedReports], [null, 2]);
    eq('kuyruk boşaldı (kotu_adam)', (await mod.listReportQueue(prisma)).some((q) => q.user.id === bad.id), false);
    await mod.moderateUser(prisma, admin.id, bad.id, 'clear_bio', {}, T);
    await mod.moderateUser(prisma, admin.id, bad.id, 'reset_images', {}, T);
    await mod.moderateUser(prisma, admin.id, bad.id, 'hide_profile', {}, T);
    row = await prisma.user.findUnique({ where: { id: bad.id } });
    eq('biyografi, görseller silindi; profil gizli', [row.bio, row.avatarUrl, row.bannerUrl, row.profilePublic], [null, null, null, false]);

    section('Oyun puanı silme ve yasaklama');
    const puzzle = await prisma.gamePuzzle.create({ data: { day: '2026-11-10', mediaId: 1, data: {} } });
    await prisma.gamePlay.create({ data: { userId: bad.id, puzzleId: puzzle.id, day: '2026-11-10', season: '2026-W46', guesses: [1], solved: true, finished: true, score: 100, streak: 1 } });
    await prisma.gamePlay.create({ data: { userId: r1.id, puzzleId: puzzle.id, day: '2026-11-10', season: '2026-W46', guesses: [1], solved: true, finished: true, score: 60, streak: 1 } });
    await prisma.user.update({ where: { id: bad.id }, data: { profilePublic: true } });
    eq('yasaktan önce sıralamada', (await game.getLeaderboard(prisma, '2026-W46')).map((r) => r.score), [100, 60]);
    await prisma.session.create({ data: { sessionToken: 'tok-bad', userId: bad.id, expires: new Date(Date.now() + 864e5) } });
    await mod.moderateUser(prisma, admin.id, bad.id, 'ban', { reason: 'Hakaret içeren ad' }, T);
    row = await prisma.user.findUnique({ where: { id: bad.id } });
    eq('yasaklandı, gerekçe kaydedildi', [!!row.bannedAt, row.banReason], [true, 'Hakaret içeren ad']);
    eq('açık oturumları kapandı', await prisma.session.count({ where: { userId: bad.id } }), 0);
    eq('yasaklı sıralamada görünmez', (await game.getLeaderboard(prisma, '2026-W46')).map((r) => r.score), [60]);
    eq('yasaklının profili yok (404)', await profile.getProfile(prisma, row.username), null);
    eq('yasaklı şikâyet edilemez', (await mod.reportUser(prisma, r1.id, { username: row.username, reason: 'NAME' }, new Date(T.getTime() + 2 * 864e5))).error, 'not_found');
    const cleared = await mod.moderateUser(prisma, admin.id, bad.id, 'clear_scores', { season: '2026-W46' }, T);
    eq('sezon puanları silindi', [cleared.details.removed, await prisma.gamePlay.count({ where: { userId: bad.id } })], [1, 0]);
    await mod.moderateUser(prisma, admin.id, bad.id, 'unban', {}, T);
    eq('yasak kalktı', (await prisma.user.findUnique({ where: { id: bad.id } })).bannedAt, null);

    section('Şikâyeti reddetme ve işlem kaydı');
    const dismissed = await mod.closeReports(prisma, admin.id, (await prisma.user.findUnique({ where: { username: 'hedef_0' } })).id, 'DISMISSED', T);
    eq('asılsız şikâyet reddedildi', dismissed.count, 1);
    const log = await mod.listAdminActions(prisma);
    eq('her işlem kayıtta (en yeni başta)', log.map((l) => l.action).slice(0, 3), ['dismiss_report', 'unban', 'clear_scores']);
    eq('kayıtta yapan yönetici', log[0].actor, 'yonetim_kisi');
    // reset_username, clear_bio, reset_images, hide_profile, ban, clear_scores, unban, dismiss_report
    eq('toplam işlem kaydı', await prisma.adminAction.count(), 8);
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
