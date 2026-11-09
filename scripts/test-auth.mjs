#!/usr/bin/env node
// Kimlik mantığı testi: `npm run test:auth`
//
// Bellekte PostgreSQL (PGlite) üzerinde gerçek Prisma Client ile test eder:
//   - kullanıcı oluşturma: kullanıcı adı üretimi, çakışma, eşzamanlı kayıt, rol, dil, e-posta küçük harf
//   - ADMIN_EMAILS terfisi ve oturum arama (geçerli / süresi dolmuş / bilinmeyen)
//   - requireUser / requireAdmin'in kullandığı yetki kararı (authorize), gerçek veritabanı satırlarıyla
//   - callbackUrl güvenliği, hata kodu eşlemesi, sağlayıcı etkinleştirme, e-posta şablonu, link hız sınırı eşiği
// Kapsam dışı: Next.js'e özgü sarmalayıcılar (çerez okuma, redirect/notFound) ve OAuth/SMTP ağ akışı: bunlar elle test edilir.
// Node'un TypeScript desteği src/lib/*.ts dosyalarını doğrudan çalıştırır; bu yüzden o dosyalar saf tutulmuştur.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaClient } from '@prisma/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (file) => import(pathToFileURL(join(root, 'src', 'lib', file)).href);
const logic = await load('auth-logic.ts');
const users = await load('auth-users.ts');
const mail = await load('auth-email-template.ts');

let failures = 0;
let total = 0;
const check = (name, ok, detail = '') => {
  total++;
  console.log(`${ok ? '✅' : '❌'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const eq = (name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), `beklenen ${JSON.stringify(expected)}, bulunan ${JSON.stringify(actual)}`);
const section = (title) => console.log(`\n— ${title}`);

/* =============================== Saf mantık =============================== */

section('ADMIN_EMAILS ayrıştırma');
eq('virgüllü liste, küçük harf, tekrarsız', logic.parseAdminEmails(' A@X.com, b@y.com ,a@x.com,, '), ['a@x.com', 'b@y.com']);
eq('boş / tanımsız', [logic.parseAdminEmails(''), logic.parseAdminEmails(undefined)], [[], []]);
check('büyük harfli e-posta listedekiyle eşleşir', logic.isAdminEmail('A@X.COM', ['a@x.com']) === true);
check('listede olmayan e-posta eşleşmez', logic.isAdminEmail('z@x.com', ['a@x.com']) === false);
check('e-posta yoksa admin değil', logic.isAdminEmail(null, ['a@x.com']) === false);

section('Kullanıcı adı üretimi');
eq('Türkçe/aksanlı ad', logic.sanitizeUsername('Ayşe.Yılmaz'), 'ayse_yilmaz');
eq('geçersiz karakterler alt çizgiye', logic.sanitizeUsername('John Doe-99!'), 'john_doe_99');
eq('çok kısa ise tamamlanır (3–20)', logic.sanitizeUsername('ab'), 'abuser');
eq('boş ise "user"', logic.sanitizeUsername(''), 'user');
eq('20 karaktere kısaltılır', logic.sanitizeUsername('a'.repeat(40)).length, 20);
eq('öncelik: GitHub adı > e-posta', logic.usernameBase({ githubLogin: 'OctoCat', email: 'x@y.com' }), 'octocat');
eq('GitHub yoksa e-postanın @ öncesi', logic.usernameBase({ email: 'Jane.Doe+news@Example.com' }), 'jane_doe_news');
eq('ikisi de yoksa görünen ad', logic.usernameBase({ name: 'Mehmet Ali' }), 'mehmet_ali');
eq('çakışma: ilk aday olduğu gibi', logic.usernameCandidate('octocat', 0), 'octocat');
eq('çakışma: sona sayı (2, 3…)', [logic.usernameCandidate('octocat', 1), logic.usernameCandidate('octocat', 2)], ['octocat2', 'octocat3']);
eq('çakışma: 20 karakteri aşmaz', logic.usernameCandidate('a'.repeat(20), 11).length, 20);

section('callbackUrl güvenliği (açık yönlendirme)');
const fb = '/tr';
eq('site içi yol kabul', logic.safeCallbackUrl('/tr/listem?x=1', fb), '/tr/listem?x=1');
for (const bad of ['https://evil.com', 'http://evil.com/x', '//evil.com', '/\\evil.com', 'javascript:alert(1)', 'evil.com', '/tr/listem\nSet-Cookie: x=1', '/a\\b', '', undefined, null, '/' + 'a'.repeat(600)]) {
  eq(`reddedilir: ${JSON.stringify(String(bad).slice(0, 30))}`, logic.safeCallbackUrl(bad, fb), fb);
}
eq('giriş sayfasına dönüş döngüsü engellenir', [logic.safeCallbackUrl('/tr/giris', fb), logic.safeCallbackUrl('/en/giris?error=x', fb)], [fb, fb]);

section('E-posta maskeleme, doğrulama');
eq('maske', logic.maskEmail('ayse.yilmaz@gmail.com'), 'a***@gmail.com');
check('geçerli e-posta', logic.isValidEmail('a@b.co') && !logic.isValidEmail('a@b') && !logic.isValidEmail('a b@c.com') && !logic.isValidEmail('x'));

section('Yetki kararı (authorize)');
eq('girişsiz → unauthenticated', [logic.authorize(null, 'user'), logic.authorize(undefined, 'admin')], ['unauthenticated', 'unauthenticated']);
eq('USER, user gereksinimi → ok', logic.authorize({ role: 'USER' }, 'user'), 'ok');
eq('USER, admin gereksinimi → forbidden', logic.authorize({ role: 'USER' }, 'admin'), 'forbidden');
const admins = ['boss@example.com'];
eq('ADMIN + e-posta listede → ok', logic.authorize({ role: 'ADMIN', email: 'Boss@Example.com' }, 'admin', admins), 'ok');
eq('ADMIN ama e-posta listeden çıkarılmış → forbidden', logic.authorize({ role: 'ADMIN', email: 'old@example.com' }, 'admin', admins), 'forbidden');
eq('ADMIN ama liste boş → forbidden (güvenli varsayılan)', logic.authorize({ role: 'ADMIN', email: 'boss@example.com' }, 'admin'), 'forbidden');
eq('e-posta listede ama rol USER → forbidden', logic.authorize({ role: 'USER', email: 'boss@example.com' }, 'admin', admins), 'forbidden');
eq('rolü olmayan, admin gereksinimi → forbidden', logic.authorize({}, 'admin'), 'forbidden');

section('Sağlayıcı etkinleştirme (yalnızca env tamamsa)');
eq('hiçbiri', logic.activeProviders({}), { github: false, email: false, discord: false });
eq('GitHub yarım → kapalı', logic.activeProviders({ AUTH_GITHUB_ID: 'x' }).github, false);
eq('GitHub tam → açık', logic.activeProviders({ AUTH_GITHUB_ID: 'x', AUTH_GITHUB_SECRET: 'y' }).github, true);
eq('e-posta tam → açık', logic.activeProviders({ EMAIL_SERVER: 'smtp://x', EMAIL_FROM: 'a@b' }).email, true);
eq('Discord env yoksa kapalı', logic.activeProviders({ AUTH_GITHUB_ID: 'x', AUTH_GITHUB_SECRET: 'y' }).discord, false);
eq('boşluklu değer tanımsız sayılır', logic.activeProviders({ AUTH_GITHUB_ID: '  ', AUTH_GITHUB_SECRET: 'y' }).github, false);

section('Hata kodu eşlemesi');
eq('Verification → expired', logic.authErrorKey('Verification'), 'expired');
eq('OAuthAccountNotLinked → linked', logic.authErrorKey('OAuthAccountNotLinked'), 'linked');
eq('EmailSignin → emailFailed', logic.authErrorKey('EmailSignin'), 'emailFailed');
eq('AccessDenied → denied', logic.authErrorKey('AccessDenied'), 'denied');
eq('bilinmeyen → generic, boş → null', [logic.authErrorKey('Foo'), logic.authErrorKey(undefined)], ['generic', null]);

section('Giriş linki e-postası');
const url = 'http://localhost:3000/api/auth/callback/nodemailer?callbackUrl=%2Fen%2Flistem&token=abc&email=a%40b.com';
eq('dil: /en callbackUrl → en', mail.mailLocaleFromUrl(url), 'en');
eq('dil: öneksiz → tr', mail.mailLocaleFromUrl('http://x/api?callbackUrl=%2Flistem'), 'tr');
const tr = mail.buildMagicLinkMail({ url, locale: 'tr', expiresMinutes: 15 });
const en = mail.buildMagicLinkMail({ url, locale: 'en', expiresMinutes: 15 });
check('tr: konu, 15 dakika, düz metin alternatifi', tr.subject.includes('giriş') && tr.text.includes('15 dakika') && tr.text.includes(url));
check('en: konu ve 15 minutes', en.subject.includes('sign-in') && en.text.includes('15 minutes'));
check('HTML: bağlantı & kaçışlanır, ham & yok', tr.html.includes('token=abc&amp;email=') && !tr.html.includes('token=abc&email='));
check('HTML: betik/enjeksiyon kaçışlanır', !mail.buildMagicLinkMail({ url: 'http://x/"><script>alert(1)</script>', locale: 'tr', expiresMinutes: 15 }).html.includes('<script>'));

section('Link hız sınırı eşiği');
const now = new Date('2026-01-01T12:00:00Z');
const cutoff = logic.magicLinkCutoff(now);
const expiresIf = (secondsAgo) => new Date(now.getTime() - secondsAgo * 1000 + logic.MAGIC_LINK_MAX_AGE * 1000);
check('10 sn önce gönderilen sınırlı sayılır', expiresIf(10) > cutoff);
check('59 sn önce gönderilen sınırlı sayılır', expiresIf(59) > cutoff);
check('61 sn önce gönderilen artık sınırlı değil', !(expiresIf(61) > cutoff));
check('5 dk önce gönderilen sınırlı değil', !(expiresIf(300) > cutoff));

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
    const ctx = { locale: 'tr', adminEmails: logic.parseAdminEmails('Boss@Example.com, second@example.com') };

    section('Kullanıcı oluşturma');
    const gh = await users.createUserRecord(prisma, { name: 'The Octocat', email: 'Octo@Example.com', image: 'https://avatars.example/octo.png', githubLogin: 'OctoCat' }, ctx);
    eq('GitHub: kullanıcı adı GitHub adından', gh.username, 'octocat');
    eq('e-posta küçük harfe çevrildi', gh.email, 'octo@example.com');
    eq('image: GitHub avatarı', gh.image, 'https://avatars.example/octo.png');
    eq('rol varsayılan USER, dil tr', [gh.role, gh.locale], ['USER', 'tr']);

    const gh2 = await users.createUserRecord(prisma, { email: 'other@example.com', githubLogin: 'octocat' }, ctx);
    eq('çakışma: sona sayı eklendi', gh2.username, 'octocat2');
    const gh3 = await users.createUserRecord(prisma, { email: 'third@example.com', githubLogin: 'octocat' }, ctx);
    eq('çakışma: üçüncüsü octocat3', gh3.username, 'octocat3');

    const mailUser = await users.createUserRecord(prisma, { email: 'Jane.Doe@Example.com' }, { ...ctx, locale: 'en' });
    eq('e-posta girişi: kullanıcı adı @ öncesinden', mailUser.username, 'jane_doe');
    eq('e-posta girişi: image boş (arayüz baş harf gösterir), dil en', [mailUser.image, mailUser.locale], [null, 'en']);

    const long = await users.createUserRecord(prisma, { email: `${'x'.repeat(30)}@example.com` }, ctx);
    const long2 = await users.createUserRecord(prisma, { email: `${'x'.repeat(30)}@other.com` }, ctx);
    check('uzun ad 20 karakterde kalır, çakışmada da 20’yi aşmaz', long.username.length === 20 && long2.username.length <= 20 && long2.username !== long.username, `${long.username} / ${long2.username}`);

    const burst = await Promise.all(Array.from({ length: 6 }, (_, i) => users.createUserRecord(prisma, { email: `race${i}@example.com`, githubLogin: 'racer' }, ctx)));
    const names = new Set(burst.map((u) => u.username));
    check('eşzamanlı 6 kayıt: hepsi benzersiz kullanıcı adı aldı, hata yok', names.size === 6, [...names].join(','));

    let dup = false;
    try {
      await users.createUserRecord(prisma, { email: 'OCTO@example.com', githubLogin: 'zzz' }, ctx);
    } catch {
      dup = true;
    }
    check('aynı e-posta ikinci kullanıcı oluşturamaz (hesap birleştirme Auth.js’te yapılır)', dup);

    section('ADMIN_EMAILS');
    const boss = await users.createUserRecord(prisma, { email: 'BOSS@example.com' }, ctx);
    eq('listedeki e-postayla ilk kayıtta ADMIN (büyük/küçük harf fark etmez)', boss.role, 'ADMIN');
    check('listede olmayan USER kalır', gh.role === 'USER');

    const later = await prisma.user.create({ data: { email: 'second@example.com', username: 'second_user' } });
    eq('mevcut USER başlangıçta USER', later.role, 'USER');
    check('mevcut kullanıcı listeye eklenince girişte terfi eder', (await users.promoteIfAdmin(prisma, later, ctx.adminEmails)) === true);
    eq('veritabanında ADMIN oldu', (await prisma.user.findUnique({ where: { id: later.id } })).role, 'ADMIN');
    check('ikinci kez terfi gerekmez (false)', (await users.promoteIfAdmin(prisma, later, ctx.adminEmails)) === false);
    check('listede olmayan kullanıcı terfi etmez', (await users.promoteIfAdmin(prisma, gh, ctx.adminEmails)) === false);
    eq('terfi etmeyen hâlâ USER', (await prisma.user.findUnique({ where: { id: gh.id } })).role, 'USER');
    check('e-postası olmayan kullanıcı terfi etmez', (await users.promoteIfAdmin(prisma, { id: gh.id, email: null }, ctx.adminEmails)) === false);

    section('Oturum arama ve yetki (requireUser / requireAdmin mantığı)');
    const day = 24 * 60 * 60 * 1000;
    await prisma.session.create({ data: { sessionToken: 'tok-user', userId: gh.id, expires: new Date(Date.now() + day) } });
    await prisma.session.create({ data: { sessionToken: 'tok-admin', userId: boss.id, expires: new Date(Date.now() + day) } });
    await prisma.session.create({ data: { sessionToken: 'tok-expired', userId: gh.id, expires: new Date(Date.now() - 1000) } });

    const sUser = await users.findSessionUser(prisma, 'tok-user');
    const sAdmin = await users.findSessionUser(prisma, 'tok-admin');
    eq('geçerli oturum kullanıcıyı verir', sUser?.id, gh.id);
    eq('süresi dolmuş oturum → null', await users.findSessionUser(prisma, 'tok-expired'), null);
    eq('bilinmeyen belirteç → null', await users.findSessionUser(prisma, 'nope'), null);
    eq('girişsiz (null kullanıcı) → unauthenticated', logic.authorize(await users.findSessionUser(prisma, 'nope'), 'user'), 'unauthenticated');
    eq('USER: requireUser → ok', logic.authorize(sUser, 'user'), 'ok');
    eq('USER: requireAdmin → forbidden (sayfada 404, eylemde 403)', logic.authorize(sUser, 'admin'), 'forbidden');
    eq('ADMIN: requireAdmin → ok', logic.authorize(sAdmin, 'admin', ctx.adminEmails), 'ok');

    await prisma.user.update({ where: { id: boss.id }, data: { role: 'USER' } });
    eq('rol veritabanında düşürülünce aynı oturum hemen yetkisiz (rol her istekte DB’den)', logic.authorize(await users.findSessionUser(prisma, 'tok-admin'), 'admin', ctx.adminEmails), 'forbidden');
    await prisma.session.delete({ where: { sessionToken: 'tok-user' } });
    eq('oturum silinince (sunucudan iptal) giriş düşer', await users.findSessionUser(prisma, 'tok-user'), null);

    section('Link hız sınırı (VerificationToken ile)');
    const identifier = 'rate@example.com';
    await prisma.verificationToken.create({ data: { identifier, token: 'recent', expires: new Date(Date.now() + logic.MAGIC_LINK_MAX_AGE * 1000) } });
    await prisma.verificationToken.create({ data: { identifier, token: 'older', expires: new Date(Date.now() + 5 * 60 * 1000) } });
    const recent = await prisma.verificationToken.count({ where: { identifier, expires: { gt: logic.magicLinkCutoff() } } });
    eq('yalnızca son dakikadaki kayıt sayılır', recent, 1);
    const none = await prisma.verificationToken.count({ where: { identifier: 'nobody@example.com', expires: { gt: logic.magicLinkCutoff() } } });
    eq('hiç link gönderilmemiş adres sınırsız', none, 0);
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
