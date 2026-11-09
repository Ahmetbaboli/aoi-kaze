#!/usr/bin/env node
// Geliştirme ortamı kontrolü: `npm run doctor`
// Her satır ✅ (tamam), ❌ (eksik) ya da ℹ️ (bilgi) ile listelenir. Gizli değerler ASLA yazdırılmaz: yalnızca var/yok.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let required = 0; // zorunlu kontrollerden başarısız olan sayısı
const lines = [];

/** ok: true/false; level 'required' başarısızsa çıkış kodunu 1 yapar; 'optional' yalnızca uyarır. */
function report(ok, label, fix, level = 'required') {
  lines.push(`${ok ? '✅' : level === 'required' ? '❌' : '⚠️ '} ${label}`);
  if (!ok) {
    if (fix) lines.push(`      → ${fix}`);
    if (level === 'required') required++;
  }
}
const info = (label) => lines.push(`ℹ️  ${label}`);

function run(command, args, options = {}) {
  // Kabuk kullanılmaz (docker ve ffmpeg gerçek .exe dosyalarıdır): argümanlar kaçışlanmadan birleştirilmez.
  return spawnSync(command, args, { encoding: 'utf8', timeout: options.timeout ?? 15000, ...options });
}

/** Çok basit .env ayrıştırıcı (yalnızca ANAHTAR=değer satırları). Değerler yalnızca bellekte tutulur. */
function readEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

/* ------------------------------ 1) Node ------------------------------ */
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const enginesNode = pkg.engines?.node;
const nodeMajor = Number(process.versions.node.split('.')[0]);
const wantedMajor = enginesNode ? Number((enginesNode.match(/(\d+)/) ?? [])[1]) : null;
report(
  wantedMajor === null || nodeMajor >= wantedMajor,
  `Node ${process.versions.node}${enginesNode ? ` (gerekli: ${enginesNode})` : ''}`,
  'winget install OpenJS.NodeJS.LTS   (kurduktan sonra terminali yeniden aç)',
);

/* ------------------------------ 2) Docker ------------------------------ */
const docker = run('docker', ['info'], { timeout: 20000 });
report(
  docker.status === 0,
  'Docker kurulu ve çalışıyor',
  'winget install Docker.DockerDesktop   (kurduktan sonra Docker Desktop\'ı aç ve motorun başlamasını bekle)',
  'optional',
);

/* ------------------------------ 3) ffmpeg ------------------------------ */
const ffmpeg = run('ffmpeg', ['-version']);
report(ffmpeg.status === 0, 'ffmpeg kurulu (yerel HLS üretimi için)', 'winget install Gyan.FFmpeg   (kurduktan sonra terminali yeniden aç)', 'optional');

/* ------------------------------ 4) .env.local ------------------------------ */
const envPath = join(root, '.env.local');
const hasEnv = existsSync(envPath);
report(hasEnv, '.env.local var', 'copy .env.example .env.local');
const fileEnv = readEnvFile(envPath);
const has = (name) => Boolean((fileEnv[name] ?? '').trim());

report(has('DATABASE_URL'), 'DATABASE_URL tanımlı', '.env.local içine .env.example\'daki DATABASE_URL satırını ekle');
report(has('AUTH_SECRET'), 'AUTH_SECRET tanımlı', 'npx auth secret   (üretilen değeri .env.local\'e AUTH_SECRET olarak yaz)');

// GitHub ve e-posta birbirinin alternatifidir; en az biri tamamsa giriş çalışır.
const githubOk = has('AUTH_GITHUB_ID') && has('AUTH_GITHUB_SECRET');
const emailOk = has('EMAIL_SERVER') && has('EMAIL_FROM');
report(has('AUTH_GITHUB_ID'), 'AUTH_GITHUB_ID tanımlı', 'github.com/settings/developers → New OAuth App → Client ID', 'optional');
report(has('AUTH_GITHUB_SECRET'), 'AUTH_GITHUB_SECRET tanımlı', 'Aynı sayfada "Generate a new client secret"', 'optional');
report(has('EMAIL_SERVER'), 'EMAIL_SERVER tanımlı', '.env.local içine EMAIL_SERVER=smtp://localhost:1025 ekle (Mailpit)', 'optional');
report(has('EMAIL_FROM'), 'EMAIL_FROM tanımlı', '.env.local içine EMAIL_FROM="Aoi Kaze <no-reply@localhost>" ekle', 'optional');
report(githubOk || emailOk, 'En az bir giriş yöntemi tam (GitHub ya da e-posta)', 'Yukarıdaki GitHub çiftini ya da e-posta çiftini tamamla');

/* ------------------------------ 5) Veritabanı ve migration ------------------------------ */
if (has('DATABASE_URL')) {
  const prismaBin = join(root, 'node_modules', 'prisma', 'build', 'index.js');
  if (!existsSync(prismaBin)) {
    report(false, 'Prisma CLI kurulu', 'npm install');
  } else {
    const status = run(process.execPath, [prismaBin, 'migrate', 'status'], {
      shell: false,
      cwd: root,
      env: { ...process.env, ...fileEnv },
      timeout: 30000,
    });
    const text = `${status.stdout ?? ''}\n${status.stderr ?? ''}`;
    if (/Database schema is up to date/i.test(text)) {
      report(true, 'Veritabanına bağlanıldı ve migration\'lar güncel');
    } else if (/have not yet been applied|following migration/i.test(text)) {
      report(true, 'Veritabanına bağlanıldı');
      report(false, 'Migration\'lar güncel', 'npm run db:migrate');
    } else if (/P1001|P1000|Can't reach database|authentication failed|connect ECONNREFUSED/i.test(text)) {
      report(false, 'Veritabanına bağlanılamadı', 'npm run db:up   (Docker Postgres) ya da DATABASE_URL\'i harici bir veritabanına yönlendir');
    } else {
      report(false, 'Veritabanı durumu okunamadı', 'npm run db:migrate   (ayrıntı için: npx dotenv -e .env.local -- prisma migrate status)');
    }
  }
} else {
  report(false, 'Veritabanı kontrolü atlandı (DATABASE_URL yok)', null);
}

/* ------------------------------ 6) Mailpit (bilgi) ------------------------------ */
try {
  const response = await fetch('http://localhost:8025/api/v1/info', { signal: AbortSignal.timeout(2000) });
  info(response.ok ? 'Mailpit erişilebilir (http://localhost:8025)' : `Mailpit yanıt verdi ama beklenmedik durum: ${response.status}`);
} catch {
  info('Mailpit erişilemiyor (http://localhost:8025). Giriş e-postalarını görmek için: docker compose up -d mailpit');
}

/* ------------------------------ 7) HLS (bilgi) ------------------------------ */
const mediaDir = join(root, 'public', 'media');
const films = existsSync(mediaDir) ? readdirSync(mediaDir).filter((name) => existsSync(join(mediaDir, name, 'master.m3u8'))) : [];
info(films.length > 0 ? `Yerel HLS var: ${films.join(', ')}` : 'public/media altında HLS yok (isteğe bağlı: npm run media:hls)');

/* ------------------------------ Özet ------------------------------ */
console.log('\nAoi Kaze ortam kontrolü\n');
console.log(lines.join('\n'));
console.log(required === 0 ? '\nZorunlu kontroller geçti.' : `\n${required} zorunlu kontrol başarısız.`);
process.exit(required === 0 ? 0 : 1);
