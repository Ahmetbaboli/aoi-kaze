#!/usr/bin/env node
// Uçtan uca kimlik testi: `npm run build && npm run test:auth:e2e`
//
// Gerçek `next start` sunucusunu, bellekte çalışan bir PostgreSQL'e (PGlite) bağlayıp çerezli HTTP istekleriyle sınar:
//   middleware yönlendirmesi, requireUser / requireAdmin, /api/auth/session, giriş sayfası, callbackUrl güvenliği.
// Gerçek GitHub OAuth ve SMTP gönderimi kapsam dışıdır (elle test edilir). Önce `npm run build` gerekir.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(join(root, '.next', 'BUILD_ID'))) {
  console.error('Önce `npm run build` çalıştır (.next/BUILD_ID bulunamadı).');
  process.exit(1);
}

let failures = 0;
let total = 0;
const check = (name, ok, detail = '') => {
  total++;
  console.log(`${ok ? '✅' : '❌'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const freePort = () =>
  new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });

const run = (args, env) =>
  new Promise((resolveRun) => {
    const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (c) => (output += c));
    child.stderr.on('data', (c) => (output += c));
    child.on('close', (code) => resolveRun({ code, output }));
  });

async function waitFor(url, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status > 0) return true;
    } catch {
      /* henüz hazır değil */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const dbPort = await freePort();
const appPort = await freePort();
const pg = await PGlite.create();
const dbServer = new PGLiteSocketServer({ db: pg, port: dbPort, host: '127.0.0.1', maxConnections: 10 });
await dbServer.start();
const databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres?sslmode=disable&connection_limit=1&pool_timeout=30`;
const base = `http://127.0.0.1:${appPort}`;

let prisma;
let app;

try {
  await pg.exec('DEALLOCATE ALL');
  const migrate = await run([join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'], { DATABASE_URL: databaseUrl });
  check('migration uygulandı', migrate.code === 0, migrate.output.slice(-300));
  if (migrate.code !== 0) throw new Error('migration başarısız');

  // Test kullanıcıları ve oturumları (Auth.js'in veritabanı oturumu: çerezin değeri sessionToken'dır)
  await pg.exec('DEALLOCATE ALL');
  prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const day = 24 * 60 * 60 * 1000;
  const member = await prisma.user.create({ data: { name: 'Test Üye', email: 'member@example.com', username: 'octocat', role: 'USER', locale: 'tr' } });
  const admin = await prisma.user.create({ data: { name: 'Test Admin', email: 'admin@example.com', username: 'bossman', role: 'ADMIN', locale: 'en' } });
  await prisma.session.create({ data: { sessionToken: 'e2e-member', userId: member.id, expires: new Date(Date.now() + day) } });
  await prisma.session.create({ data: { sessionToken: 'e2e-admin', userId: admin.id, expires: new Date(Date.now() + day) } });
  await prisma.session.create({ data: { sessionToken: 'e2e-expired', userId: member.id, expires: new Date(Date.now() - 1000) } });
  await prisma.$disconnect();
  prisma = undefined;
  await pg.exec('DEALLOCATE ALL');

  // Uygulama sunucusu
  app = spawn(process.execPath, [join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(appPort), '-H', '127.0.0.1'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: 'e2e-test-secret-e2e-test-secret-e2e-test-secret',
      AUTH_TRUST_HOST: 'true',
      AUTH_URL: base,
      AUTH_GITHUB_ID: 'dummy-id',
      AUTH_GITHUB_SECRET: 'dummy-secret',
      EMAIL_SERVER: 'smtp://127.0.0.1:1',
      EMAIL_FROM: 'Aoi Kaze <no-reply@localhost>',
      ADMIN_EMAILS: 'admin@example.com',
      NEXT_PUBLIC_DISCORD_INVITE: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let appLog = '';
  app.stdout.on('data', (c) => (appLog += c));
  app.stderr.on('data', (c) => (appLog += c));

  const ready = await waitFor(`${base}/tr/giris`);
  check('uygulama sunucusu başladı', ready, appLog.slice(-400));
  if (!ready) throw new Error('sunucu başlamadı');

  const get = (path, cookie) =>
    fetch(`${base}${path}`, { redirect: 'manual', headers: cookie ? { cookie: `authjs.session-token=${cookie}` } : {} });
  const location = (response) => response.headers.get('location') ?? '';
  /** Formdaki gizli callbackUrl alanının değeri (RSC verisindeki searchParams'a değil, gerçek input'a bakar). */
  const hiddenCallback = (page) => (page.match(/<input[^>]*name="callbackUrl"[^>]*>/)?.[0].match(/value="([^"]*)"/) ?? [])[1];

  /* ---------- Middleware (veritabanına dokunmadan) ---------- */
  let r = await get('/tr/hesap');
  check('girişsiz /tr/hesap → giriş sayfası (307)', r.status === 307 && location(r).includes('/tr/giris') && location(r).includes('callbackUrl=%2Ftr%2Fhesap'), `${r.status} ${location(r)}`);
  r = await get('/en/admin');
  check('girişsiz /en/admin → /en/giris (307)', r.status === 307 && location(r).includes('/en/giris') && location(r).includes('callbackUrl=%2Fen%2Fadmin'), `${r.status} ${location(r)}`);
  r = await get('/hesap');
  check('dil önekisiz /hesap önce dile yönlenir', r.status === 307 && /\/(tr|en)\/hesap$/.test(location(r)), `${r.status} ${location(r)}`);
  r = await get('/giris');
  check('/giris dil önekli sayfaya yönlenir (auth.config yolu)', r.status === 307 && /\/(tr|en)\/giris$/.test(location(r)), `${r.status} ${location(r)}`);

  /* ---------- requireUser ---------- */
  r = await get('/tr/hesap', 'e2e-member');
  let html = await r.text();
  check('geçerli oturum: /tr/hesap 200 ve kullanıcı bilgisi', r.status === 200 && html.includes('@octocat') && html.includes('member@example.com'), `${r.status}`);
  r = await get('/tr/hesap', 'bogus-token');
  check('sahte çerez middleware’i geçer ama requireUser giriş sayfasına yollar', r.status === 307 && location(r).includes('/tr/giris'), `${r.status} ${location(r)}`);
  r = await get('/tr/hesap', 'e2e-expired');
  check('süresi dolmuş oturum → giriş sayfası', r.status === 307 && location(r).includes('/tr/giris'), `${r.status} ${location(r)}`);

  /* ---------- requireAdmin ---------- */
  r = await get('/tr/admin', 'e2e-member');
  check('USER: /tr/admin → 404 (sayfanın varlığı belli edilmez)', r.status === 404, `${r.status}`);
  r = await get('/en/admin', 'e2e-admin');
  html = await r.text();
  check('ADMIN: /en/admin → 200', r.status === 200 && html.includes('Admin panel'), `${r.status}`);

  /* ---------- Oturum uç noktası ve sağlayıcılar ---------- */
  r = await get('/api/auth/session', 'e2e-admin');
  const session = await r.json();
  check('/api/auth/session: id, username, role, locale döner', session?.user?.id && session.user.username === 'bossman' && session.user.role === 'ADMIN' && session.user.locale === 'en', JSON.stringify(session));
  r = await get('/api/auth/session');
  eq: {
    const empty = await r.json();
    check('girişsiz /api/auth/session boş', empty === null || Object.keys(empty ?? {}).length === 0, JSON.stringify(empty));
  }
  r = await get('/api/auth/providers');
  const providers = Object.keys(await r.json());
  check('etkin sağlayıcılar: github + nodemailer (discord yok)', providers.includes('github') && providers.includes('nodemailer') && !providers.includes('discord'), providers.join(','));

  /* ---------- Giriş sayfası ---------- */
  r = await get('/tr/giris');
  html = await r.text();
  check('giriş sayfası: GitHub düğmesi ve e-posta formu', r.status === 200 && html.includes('GitHub ile devam et') && html.includes('Giriş linki gönder'));
  check('giriş sayfası: Discord ile giriş düğmesi yok', !/Discord ile|with Discord/i.test(html));
  r = await get('/tr/giris?callbackUrl=https%3A%2F%2Fevil.com');
  html = await r.text();
  check('callbackUrl=https://evil.com → gizli alan site ana sayfasına düşer', hiddenCallback(html) === '/tr', `gizli alan: ${hiddenCallback(html)}`);
  r = await get('/tr/giris?callbackUrl=%2F%2Fevil.com');
  html = await r.text();
  check('callbackUrl=//evil.com reddedilir', hiddenCallback(html) === '/tr', `gizli alan: ${hiddenCallback(html)}`);
  r = await get('/tr/giris?callbackUrl=%2Ftr%2Flistem');
  html = await r.text();
  check('callbackUrl=/tr/listem korunur', hiddenCallback(html) === '/tr/listem', `gizli alan: ${hiddenCallback(html)}`);
  r = await get('/tr/giris?error=Verification');
  html = await r.text();
  check('süresi dolmuş link hatası gösterilir', html.includes('süresi dolmuş'));
  r = await get('/tr/giris?error=OAuthAccountNotLinked');
  html = await r.text();
  check('hesap başka yöntemle bağlı hatası gösterilir', html.includes('başka bir giriş yöntemiyle'));
  r = await get('/tr/giris?sent=a***%40gmail.com');
  html = await r.text();
  check('"E-postanı kontrol et" ekranı, maskelenmiş adres', html.includes('E-postanı kontrol et') && html.includes('a***@gmail.com'));
  r = await get('/en/giris');
  html = await r.text();
  check('İngilizce giriş sayfası', html.includes('Continue with GitHub') && html.includes('Send sign-in link'));

  /* ---------- Girişliyken giriş sayfası ---------- */
  r = await get('/tr/giris?callbackUrl=%2Ftr%2Flistem', 'e2e-member');
  check('girişliyken giriş sayfası geldiği sayfaya yönlendirir', r.status === 307 && location(r).endsWith('/tr/listem'), `${r.status} ${location(r)}`);
  r = await get('/tr/giris?callbackUrl=https%3A%2F%2Fevil.com', 'e2e-member');
  check('girişliyken kötü callbackUrl ana sayfaya düşer (açık yönlendirme yok)', r.status === 307 && !location(r).includes('evil.com') && location(r).endsWith('/tr'), `${r.status} ${location(r)}`);

  /* ---------- Statik sayfalar çerez okumadan statik kalır ---------- */
  r = await get('/tr/blog');
  check('statik sayfa (blog) giriş olmadan açılır', r.status === 200);
} catch (error) {
  check('uçtan uca test çöktü', false, error?.stack ?? String(error));
} finally {
  if (app) app.kill();
  if (prisma) await prisma.$disconnect();
  await dbServer.stop();
  await pg.close();
}

console.log(failures === 0 ? `\nTÜM KONTROLLER GEÇTİ (${total})` : `\n${failures} / ${total} KONTROL BAŞARISIZ`);
process.exit(failures === 0 ? 0 : 1);
