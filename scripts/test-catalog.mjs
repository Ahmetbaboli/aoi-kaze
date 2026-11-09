#!/usr/bin/env node
// Katalog yardımcıları testi: `npm run test:catalog`
//   - AniList açıklama ayrıştırıcısı: spoiler blokları, markdown/HTML temizliği, bilgi satırları (src/lib/catalog/rich-text.ts)
//   - esere özel tema: kontrast eşikleri ve türe göre doku (src/lib/media-theme.ts)
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (file) => import(pathToFileURL(join(root, 'src', 'lib', file)).href);
const rich = await load('catalog/rich-text.ts');
const theme = await load('media-theme.ts');

let failures = 0;
let total = 0;
const check = (name, ok, detail = '') => {
  total++;
  console.log(`${ok ? '✅' : '❌'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const eq = (name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), `beklenen ${JSON.stringify(expected)}, bulunan ${JSON.stringify(actual)}`);
const section = (title) => console.log(`\n— ${title}`);

section('Açıklama ayrıştırıcı');
eq('düz metin tek paragraf', rich.parseRichText('Merhaba dünya.'), [[{ kind: 'text', text: 'Merhaba dünya.' }]]);
eq('spoiler ayrı parça', rich.parseRichText('Önce ~!sonunda ölür!~ sonra.'), [[{ kind: 'text', text: 'Önce ' }, { kind: 'spoiler', text: 'sonunda ölür' }, { kind: 'text', text: ' sonra.' }]]);
eq('kapanmamış spoiler sona kadar gizli kalır', rich.parseRichText('A ~!gizli devam'), [[{ kind: 'text', text: 'A ' }, { kind: 'spoiler', text: 'gizli devam' }]]);
eq('boş satır yeni paragraf', rich.parseRichText('Bir.\n\nİki.').length, 2);
eq('markdown ve bağlantılar temizlenir', rich.parseRichText('__Kalın__ ve [link](https://x.y) <b>html</b>')[0][0].text, 'Kalın ve link html');
check('HTML/betik etiketi metne kalmaz', !JSON.stringify(rich.parseRichText('<script>alert(1)</script>x')).includes('<script'));
eq('HTML varlıkları çözülür', rich.parseRichText('Tom &amp; Jerry &quot;x&quot;')[0][0].text, 'Tom & Jerry "x"');
eq('boş / null', [rich.parseRichText(''), rich.parseRichText(null)], [[], []]);

section('Bilgi satırları (splitFacts)');
const { facts, body } = rich.splitFacts('__Height:__ 170 cm\n__Affiliation:__ Survey Corps\n\nEren is the protagonist.');
eq('baştaki satırlar bilgi olarak ayrılır', facts, [{ label: 'Height', value: '170 cm' }, { label: 'Affiliation', value: 'Survey Corps' }]);
eq('gövde kalır', body.trim(), 'Eren is the protagonist.');
eq('spoiler içeren bilgi satırı ayrılmaz (gövdede gizli kalır)', rich.splitFacts('__Status:__ ~!Dead!~\nMetin').facts, []);
eq('bilgi satırı yoksa gövde aynen', rich.splitFacts('Sadece metin.').body, 'Sadece metin.');

section('Esere özel tema (kontrast)');
const LIGHT = [248, 250, 252];
const DARK = [10, 10, 16];
const ch = (v) => v.split(' ').map(Number);
for (const hex of ['#f1e478', '#e4f1ff', '#ff0000', '#1a1a1a', '#43a1e4', '#fff', '#000000', '#5dbb0d']) {
  const vars = theme.mediaThemeVars(hex);
  const ok =
    theme.contrast(ch(vars['--primary']), [255, 255, 255]) >= theme.MIN_CONTRAST &&
    theme.contrast(ch(vars['--m-text-light']), LIGHT) >= theme.MIN_CONTRAST &&
    theme.contrast(ch(vars['--m-text-dark']), DARK) >= theme.MIN_CONTRAST;
  check(`${hex}: düğme, açık ve koyu temada ≥ 4.5:1`, ok, JSON.stringify(vars));
}
eq('zaten koyu renk değişmeden kalır (düğme)', theme.mediaThemeVars('#1a1a1a')['--primary'], '26 26 26');
eq('geçersiz renk → null (varsayılan tema)', [theme.mediaThemeVars(null), theme.mediaThemeVars('kırmızı'), theme.mediaThemeVars('#12345')], [null, null, null]);
eq('3 haneli hex', theme.parseHex('#abc'), [170, 187, 204]);

section('Türe göre doku');
eq('korku önceliklidir', theme.moodFor(['Action', 'Horror']), 'eerie');
eq('aksiyon → hız çizgileri', theme.moodFor(['Action', 'Comedy']), 'speed');
eq('bilim kurgu → ızgara', theme.moodFor(['Sci-Fi']), 'grid');
eq('romantik → yumuşak', theme.moodFor(['Romance', 'Comedy']), 'soft');
eq('eşleşme yoksa null', theme.moodFor(['Comedy']), null);

console.log(failures === 0 ? `\nTÜM KONTROLLER GEÇTİ (${total})` : `\n${failures} / ${total} KONTROL BAŞARISIZ`);
process.exit(failures === 0 ? 0 : 1);
