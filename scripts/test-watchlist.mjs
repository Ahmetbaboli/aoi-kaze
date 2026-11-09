#!/usr/bin/env node
// Listem senkronu testi: `npm run test:watchlist`
//
// Bellekte PostgreSQL (PGlite) üzerinde, gerçek migration'lar ve Prisma Client ile src/lib/watchlist-sync.ts'i test eder:
//   - doğrulama/temizleme (geçersiz işlemler atlanır, gelecekteki saat kırpılır, https olmayan kapak atılır)
//   - ilk birleştirme, son yazan kazanır (bayat kopya yeniyi ezemez), silme, tür/durum eşlemesi
//   - kullanıcılar arası yalıtım, işlem sınırı, girişsiz çağrı
// Kapsam dışı: istemci kuyruğu ve oturum köprüsü (src/lib/watchlist.ts) — tarayıcıda elle test edilir.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sync = await import(pathToFileURL(join(root, 'src', 'lib', 'watchlist-sync.ts')).href);

let failures = 0;
let total = 0;
const check = (name, ok, detail = '') => {
  total++;
  console.log(`${ok ? '✅' : '❌'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const eq = (name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), `beklenen ${JSON.stringify(expected)}, bulunan ${JSON.stringify(actual)}`);
const section = (title) => console.log(`\n— ${title}`);

const T = 1_800_000_000_000; // sabit "şimdi"
const entry = (id, patch = {}) => ({ id, kind: 'anime', title: `Eser ${id}`, cover: `https://img.example/${id}.jpg`, color: '#aabbcc', status: 'planned', favorite: false, updatedAt: T - 1000, ...patch });
const put = (id, patch) => ({ op: 'put', entry: entry(id, patch) });

/* =============================== Saf mantık =============================== */

section('Doğrulama (parseOps)');
eq('dizi değil → null', [sync.parseOps(null), sync.parseOps({})], [null, null]);
eq('geçersiz işlemler atlanır', sync.parseOps([put(1), { op: 'x' }, put(0), put(2, { kind: 'film' }), put(3, { title: '  ' }), put(4, { status: 'nope' }), { op: 'delete', id: -1, at: T }], T).map((o) => o.entry?.id ?? o.id), [1]);
eq('gelecekteki saat sunucu saatine çekilir', sync.parseOps([put(1, { updatedAt: T + 999_999 }), { op: 'delete', id: 2, at: T + 5 }], T).map((o) => o.entry?.updatedAt ?? o.at), [T, T]);
eq('https olmayan kapak ve geçersiz renk atılır', (({ cover, color }) => [cover, color])(sync.parseOps([put(1, { cover: 'javascript:alert(1)', color: 'red;x' })], T)[0].entry), [null, null]);
eq('başlıktaki kontrol karakterleri temizlenir', sync.parseOps([put(1, { title: 'A\u0000\nB' })], T)[0].entry.title, 'A B');
eq('negatif ilerleme reddedilir', sync.parseOps([put(1, { progress: -2 })], T).length, 0);

section('Sıkıştırma (compactOps)');
eq('aynı eser için en yeni işlem kalır', sync.compactOps([put(1, { updatedAt: 5 }), { op: 'delete', id: 1, at: 9 }, put(1, { updatedAt: 7 })]), [{ op: 'delete', id: 1, at: 9 }]);

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
    const a = await prisma.user.create({ data: { email: 'a@example.com', username: 'user_a' } });
    const b = await prisma.user.create({ data: { email: 'b@example.com', username: 'user_b' } });
    const apply = (user, ops, now = T) => sync.applyListOps(prisma, user, ops, now);
    const ids = (r) => (r.ok ? r.entries.map((e) => e.id) : r.error);

    section('Yetki ve sınırlar');
    eq('girişsiz → unauthorized', await apply(null, []), { ok: false, error: 'unauthorized' });
    eq('dizi değil → invalid', await apply(a.id, 'x'), { ok: false, error: 'invalid' });
    eq('çok fazla işlem → too_many', await apply(a.id, Array.from({ length: sync.SYNC_MAX_OPS + 1 }, (_, i) => put(i + 1))), { ok: false, error: 'too_many' });
    eq('boş liste okunur', await apply(a.id, []), { ok: true, entries: [] });

    section('İlk birleştirme ve okuma');
    const first = await apply(a.id, [put(10, { updatedAt: T - 3000 }), put(20, { kind: 'manhwa', status: 'current', progress: 12, updatedAt: T - 2000 }), put(30, { status: null, favorite: true, updatedAt: T - 1000 })]);
    eq('yeniden eskiye sıralı döner', ids(first), [30, 20, 10]);
    const m = first.entries.find((e) => e.id === 20);
    eq('tür, durum, ilerleme, kapak korunur', [m.kind, m.status, m.progress, m.cover, m.color], ['manhwa', 'current', 12, 'https://img.example/20.jpg', '#aabbcc']);
    eq('ilerleme 0 iken alan yok', 'progress' in first.entries.find((e) => e.id === 10), false);
    eq('veritabanında durum eşlemesi (current → WATCHING)', (await prisma.listEntry.findFirst({ where: { userId: a.id, anime: { anilistId: 20 } } })).status, 'WATCHING');
    eq('eser satırı bir kez oluşur', await prisma.anime.count({ where: { anilistId: { in: [10, 20, 30] } } }), 3);

    section('Son yazan kazanır');
    await apply(a.id, [put(10, { status: 'completed', updatedAt: T - 500 })]);
    await apply(a.id, [put(10, { status: 'dropped', updatedAt: T - 2500 })]); // başka cihazdan bayat kopya
    eq('bayat kopya yeniyi ezemez', (await apply(a.id, [])).entries.find((e) => e.id === 10).status, 'completed');
    eq('eski silme yeni girdiyi silmez', ids(await apply(a.id, [{ op: 'delete', id: 10, at: T - 600 }])).includes(10), true);
    eq('yeni silme girdiyi siler', ids(await apply(a.id, [{ op: 'delete', id: 10, at: T - 400 }])).includes(10), false);
    eq('durumsuz ve favorisiz put silme sayılır', ids(await apply(a.id, [put(30, { status: null, favorite: false, updatedAt: T - 100 })])), [20]);
    eq('olmayan girdiyi silmek hata vermez', ids(await apply(a.id, [{ op: 'delete', id: 999, at: T }])), [20]);
    await apply(a.id, [put(20, { kind: 'manhwa', status: 'current', cover: null, color: null, updatedAt: T - 50 })]);
    eq('boş kapak mevcut önbelleği silmez', (await apply(a.id, [])).entries[0].cover, 'https://img.example/20.jpg');

    section('Kullanıcı yalıtımı');
    eq('B, A’nın listesini görmez', await apply(b.id, []), { ok: true, entries: [] });
    await apply(b.id, [put(20, { status: 'planned', updatedAt: T })]);
    eq('aynı esere iki kullanıcı ayrı girdi tutar', [(await apply(a.id, [])).entries[0].status, (await apply(b.id, [])).entries[0].status], ['current', 'planned']);
    await apply(b.id, [{ op: 'delete', id: 20, at: T }]);
    eq('B’nin silmesi A’yı etkilemez', ids(await apply(a.id, [])), [20]);

    section('Toplu işlem');
    const bulk = await apply(b.id, Array.from({ length: sync.SYNC_MAX_OPS }, (_, i) => put(1000 + i, { updatedAt: T - i })));
    eq(`${sync.SYNC_MAX_OPS} işlem tek istekte yazılır`, bulk.ok && bulk.entries.length, sync.SYNC_MAX_OPS);
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
