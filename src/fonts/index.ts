import localFont from 'next/font/local';

/**
 * Yazı tipleri projeye gömülüdür (SIL Open Font License; lisanslar bu klasörde):
 * Google Fonts'a istek atılmaz, build ağ/sertifika sorunlarından etkilenmez, ziyaretçi verisi dışarı sızmaz.
 * Kaynak: @fontsource paketlerinin woff2 dosyaları (latin + latin-ext = Türkçe karakterler dahil).
 *
 * Her yazı tipi iki ailedir (latin ve latin-ext); tarayıcı karakter aralığına göre doğru dosyayı seçer.
 * adjustFontFallback kapalı: aksi halde araya giren yedek font latin-ext'in devreye girmesini engeller.
 *
 * NOT: next/font yalnızca açık (literal) değerleri kabul eder; bu yüzden değerler tekrarlanmıştır.
 */

/** Tüm metin: Nunito (değişken ağırlık) */
export const bodyLatin = localFont({
  src: './nunito-latin-wght-normal.woff2',
  weight: '200 1000',
  variable: '--font-body',
  display: 'swap',
  adjustFontFallback: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    },
  ],
});

export const bodyExt = localFont({
  src: './nunito-latin-ext-wght-normal.woff2',
  weight: '200 1000',
  variable: '--font-body-ext',
  display: 'swap',
  adjustFontFallback: false,
  preload: false,
  declarations: [
    {
      prop: 'unicode-range',
      value:
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    },
  ],
});

/** <html> öğesine eklenecek tüm değişken sınıfları */
export const fontVariables = [bodyLatin, bodyExt].map((font) => font.variable).join(' ');
