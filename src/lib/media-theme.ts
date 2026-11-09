// Eserin rengine bürünen sayfa teması. Saf mantık (içe aktarma yok): `scripts/test-catalog.mjs` doğrudan çalıştırır.
//
// AniList her eser için kapağın baskın rengini verir. Bu renk doğrudan kullanılırsa çoğu zaman okunmaz
// (ör. açık sarı üstünde beyaz yazı). Burada renk, WCAG kontrast eşiklerini sağlayana kadar koyulaştırılır/açılır:
//  - --primary        : düğme/rozet dolgusu; üstündeki beyaz yazıyla en az 4.5:1
//  - --m-text-light   : açık temada bağlantı/vurgu yazısı; açık zeminle en az 4.5:1
//  - --m-text-dark    : koyu temada bağlantı/vurgu yazısı; koyu zeminle en az 4.5:1
// Değerler Tailwind'in beklediği "r g b" kanal biçimindedir (globals.css'teki jetonlarla aynı).

type RGB = [number, number, number];

const LIGHT_BG: RGB = [248, 250, 252]; // --bg (açık)
const DARK_BG: RGB = [10, 10, 16]; // --bg (koyu)
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
export const MIN_CONTRAST = 4.5;

export function parseHex(hex: string | null | undefined): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: RGB) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const mix = (from: RGB, to: RGB, t: number): RGB => from.map((c, i) => Math.round(c + (to[i] - c) * t)) as RGB;

/** Rengi `toward` yönüne (siyah/beyaz) adım adım kaydırır; `against` ile kontrast eşiği sağlanınca durur. */
function adjust(color: RGB, against: RGB, toward: RGB): RGB {
  for (let t = 0; t <= 1.0001; t += 0.04) {
    const candidate = mix(color, toward, t);
    if (contrast(candidate, against) >= MIN_CONTRAST) return candidate;
  }
  return toward;
}

const rgbVar = ([r, g, b]: RGB) => `${r} ${g} ${b}`;

export interface MediaThemeVars {
  '--primary': string;
  '--m-text-light': string;
  '--m-text-dark': string;
  /** Hero ışıması için orijinal renk (kontrast gerekmeyen süsleme) */
  '--m-glow': string;
}

/** Eser rengi geçersizse null: sayfa sitenin varsayılan temasıyla kalır. */
export function mediaThemeVars(hex: string | null | undefined): MediaThemeVars | null {
  const base = parseHex(hex);
  if (!base) return null;
  return {
    '--primary': rgbVar(adjust(base, WHITE, BLACK)),
    '--m-text-light': rgbVar(adjust(base, LIGHT_BG, BLACK)),
    '--m-text-dark': rgbVar(adjust(base, DARK_BG, WHITE)),
    '--m-glow': rgbVar(base),
  };
}

/** Türe göre hero dokusu (globals.css → .mood-*). İlk eşleşen kazanır; hiçbiri yoksa null. */
export type Mood = 'eerie' | 'speed' | 'grid' | 'sparkle' | 'soft';
const MOODS: [Mood, string[]][] = [
  ['eerie', ['Horror', 'Psychological', 'Thriller']],
  ['grid', ['Sci-Fi', 'Mecha']],
  ['speed', ['Action', 'Sports', 'Racing']],
  ['sparkle', ['Fantasy', 'Supernatural', 'Mahou Shoujo']],
  ['soft', ['Romance', 'Slice of Life']],
];

export function moodFor(genres: string[]): Mood | null {
  const set = new Set(genres);
  return MOODS.find(([, list]) => list.some((g) => set.has(g)))?.[0] ?? null;
}
