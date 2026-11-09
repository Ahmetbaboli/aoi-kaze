// AniList karakter/kişi açıklamalarını güvenli, düz metin parçalarına çevirir. Saf mantık (içe aktarma yok):
// `scripts/test-catalog.mjs` doğrudan çalıştırır.
//
// AniList açıklamaları basit markdown + HTML içerir: `__kalın__`, `[metin](url)`, `<br>`, ve spoiler için `~!gizli!~`.
// HTML olarak basılmaz (XSS riski yok): her şey düz metne indirgenir, spoiler blokları ayrı işaretlenir
// ki sayfa onları tıklayınca açılan bir düğme olarak çizebilsin.

export type RichSegment = { kind: 'text' | 'spoiler'; text: string };
export type RichText = RichSegment[][];

const ENTITIES: Record<string, string> = { '&quot;': '"', '&#039;': "'", '&apos;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };

/** Markdown ve HTML işaretlerini atar; bağlantıların yalnızca metni kalır. */
function plain(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // görseller
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // bağlantılar
    .replace(/(\*\*|__)(.+?)\1/g, '$2') // kalın
    .replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|$|[.,!?])/g, '$1$2') // italik
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/&(?:quot|#039|apos|amp|lt|gt|nbsp);/g, (e) => ENTITIES[e] ?? e);
}

/**
 * Açıklamayı paragraflara ve paragrafları metin/spoiler parçalarına böler.
 * Kapanmamış spoiler (`~!` var, `!~` yok) metnin sonuna kadar spoiler sayılır: gizli kalması güvenli taraftır.
 */
export function parseRichText(raw: string | null | undefined, maxLength = 4000): RichText {
  const source = (raw ?? '').replace(/\r\n?/g, '\n').slice(0, maxLength);
  const segments: RichSegment[] = [];
  let rest = source;
  while (rest.length > 0) {
    const open = rest.indexOf('~!');
    if (open === -1) {
      segments.push({ kind: 'text', text: rest });
      break;
    }
    if (open > 0) segments.push({ kind: 'text', text: rest.slice(0, open) });
    const close = rest.indexOf('!~', open + 2);
    segments.push({ kind: 'spoiler', text: rest.slice(open + 2, close === -1 ? undefined : close) });
    rest = close === -1 ? '' : rest.slice(close + 2);
  }

  // Paragraflara böl: metin parçalarındaki boş satırlar yeni paragraf başlatır; spoiler bölünmez.
  const paragraphs: RichText = [[]];
  for (const segment of segments) {
    const text = plain(segment.text);
    if (segment.kind === 'spoiler') {
      if (text.trim()) paragraphs[paragraphs.length - 1].push({ kind: 'spoiler', text: text.trim() });
      continue;
    }
    text.split(/\n\s*\n/).forEach((part, index) => {
      if (index > 0) paragraphs.push([]);
      const cleaned = part.replace(/\n+/g, ' ').replace(/[ \t]{2,}/g, ' ');
      if (cleaned.trim()) paragraphs[paragraphs.length - 1].push({ kind: 'text', text: cleaned });
    });
  }
  return paragraphs
    .map((p) => {
      if (p.length === 0) return p;
      p[0] = { ...p[0], text: p[0].text.trimStart() };
      p[p.length - 1] = { ...p[p.length - 1], text: p[p.length - 1].text.trimEnd() };
      return p.filter((s) => s.text.length > 0);
    })
    .filter((p) => p.length > 0);
}

/**
 * AniList karakter açıklamalarının başındaki "__Yaş:__ 19" gibi bilgi satırlarını ayırır (sayfa onları tabloda gösterir).
 * Yalnızca baştaki ardışık satırlar alınır; en fazla 12 satır, değerler 120 karakterle sınırlı.
 */
export function splitFacts(raw: string | null | undefined): { facts: { label: string; value: string }[]; body: string } {
  const lines = (raw ?? '').replace(/\r\n?/g, '\n').split('\n');
  const facts: { label: string; value: string }[] = [];
  let i = 0;
  for (; i < lines.length && facts.length < 12; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (facts.length > 0) continue;
      continue;
    }
    const match = /^(?:__|\*\*)([^_*:]{1,40}?):?(?:__|\*\*):?\s*(.+)$/.exec(line);
    if (!match || match[2].includes('~!')) break;
    facts.push({ label: plain(match[1]).trim(), value: plain(match[2]).trim().slice(0, 120) });
  }
  return { facts, body: lines.slice(i).join('\n') };
}
