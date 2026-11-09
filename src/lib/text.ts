/** Büyük/küçük harf ve Türkçe karakter farkını yok sayan arama biçimi: "Işık" ile "isik" eşleşir. */
export const fold = (value: string) =>
  value
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');

interface Field {
  text: string;
  weight: number;
}

/** Tüm sözcükler bulunursa puan döner (başlık > etiket > gövde), yoksa 0. */
export function score(query: string, fields: Field[]): number {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const folded = fields.map((f) => ({ text: fold(f.text), weight: f.weight }));

  let total = 0;
  for (const token of tokens) {
    const best = Math.max(0, ...folded.map((f) => (f.text.includes(token) ? f.weight : 0)));
    if (best === 0) return 0;
    total += best;
  }
  return total;
}
