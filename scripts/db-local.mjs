#!/usr/bin/env node
// Docker'sız yerel PostgreSQL: `npm run db:local`
//
// PGlite (WebAssembly ile çalışan gerçek PostgreSQL) veriyi `.pglite/` klasörüne kalıcı olarak yazar ve
// 127.0.0.1:5433 üzerinden normal bir Postgres sunucusu gibi bağlantı kabul eder. Ağa çıkmaz; kurumsal
// güvenlik duvarı 5432'yi engellese de çalışır. Yalnızca geliştirme içindir; canlıda gerçek PostgreSQL kullan.
//
// .env.local:
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable&connection_limit=1&pgbouncer=true
//
// `pgbouncer=true` gerekli: tüm bağlantılar tek bir PGlite oturumunu paylaşır; Prisma bu ayarla adlı hazır
// sorgu (prepared statement) önbelleğini kapatır, böylece migrate / seed / next dev aynı anda çakışmadan çalışır.
// Bu pencere açık kaldığı sürece veritabanı çalışır; durdurmak için Ctrl+C.
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, '.pglite');
const port = Number(process.env.PGLITE_PORT ?? 5433);
const host = '127.0.0.1';

mkdirSync(dataDir, { recursive: true });
const db = await PGlite.create(dataDir);
const server = new PGLiteSocketServer({ db, port, host, maxConnections: 20 });

try {
  await server.start();
} catch (error) {
  console.error(`❌ ${host}:${port} açılamadı (${error?.code ?? error}). Başka bir pencerede zaten çalışıyor olabilir.`);
  await db.close();
  process.exit(1);
}

console.log(`✅ Yerel PostgreSQL hazır: ${host}:${port}  (veri: .pglite/)`);
console.log(`   DATABASE_URL=postgresql://postgres:postgres@${host}:${port}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`);
console.log('   Bu pencereyi açık bırak. Durdurmak için Ctrl+C.');

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  console.log('\nKapatılıyor…');
  await server.stop().catch(() => {});
  await db.close().catch(() => {}); // veriyi diske düzgün yazar
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
