// Kullanıcı adı ve biyografi için küfür / +18 filtresi. Saf mantık: `scripts/test-profile.mjs` doğrudan çalıştırır.
//
// Yaklaşım: metin normalize edilir (Türkçe harfler → ASCII, "leet" yazımı → harf, tekrarlanan harfler teke iner,
// harf dışı her şey atılır), sonra iki listeyle karşılaştırılır:
//  - SUBSTRING: başka bir kelimenin içinde masum geçmesi pek olası olmayan uzun kelimeler (her yerde aranır)
//  - TOKEN: kısa ya da masum kelimelerin içinde geçebilen kelimeler (yalnızca tam kelime olarak aranır;
//    ör. "pic" → "picasso" engellenmez, "got" → "gothic" engellenmez)
// Hiçbir liste kusursuz değildir; bu yüzden profil sayfalarında ayrıca şikâyet/moderasyon gerekir.

const TR_MAP: Record<string, string> = { ı: 'i', İ: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };
const LEET_MAP: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i', '|': 'i', '€': 'e' };

/** Küçük harf + Türkçe harfleri ASCII'ye çevirir. */
const fold = (text: string) =>
  text
    .replace(/[ıİşğüöçâîû]/g, (c) => TR_MAP[c] ?? c)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');

/** Leet karakterlerini harfe çevirir, harf dışını atar, tekrarlanan harfleri teke indirir ("s1iiiik" → "sik"). */
const squash = (text: string) =>
  fold(text)
    .replace(/[0134578@$!|€]/g, (c) => LEET_MAP[c] ?? c)
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1');

/** Leet karakterlerini harfe çevirir ve harf dışını atar; tekrarları korur (kısa kelimelerin tam eşleşmesi için). */
const deleet = (text: string) =>
  fold(text)
    .replace(/[0134578@$!|€]/g, (c) => LEET_MAP[c] ?? c)
    .replace(/[^a-z]/g, '');

/**
 * Kelimelere böler (boşluk, alt çizgi, tire, nokta ayırıcıdır). Tek harflik ardışık parçalar birleştirilir:
 * "f u c k" / "s.i.k" gibi aralıklı yazım tek kelime sayılır.
 */
function tokens(text: string): string[] {
  const parts = fold(text).split(/[\s_\-.,;:'"()/\\]+/).filter(Boolean);
  const out: string[] = [];
  let run = '';
  for (const part of parts) {
    if (deleet(part).length === 1) {
      run += part;
      continue;
    }
    if (run) out.push(run);
    run = '';
    out.push(part);
  }
  if (run) out.push(run);
  return out;
}

const SUBSTRING_RAW = [
  // Türkçe
  'amcik', 'aminakoy', 'aminako', 'orospu', 'orosbu', 'pezevenk', 'yarrak', 'dalyarak', 'siktir', 'sikerim', 'sikeyim',
  'sikis', 'sikik', 'siktig', 'gotveren', 'kahpe', 'yavsak', 'ibne', 'kevase', 'kaltak', 'serefsiz', 'surtuk', 'gavat',
  // İngilizce
  'fuck', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'whore', 'pussy', 'porn', 'hentai', 'nsfw', 'rapist', 'penis',
  'vagina', 'blowjob', 'handjob', 'dildo', 'onlyfans', 'cumshot', 'incest', 'hitler',
];
// Kısa ya da başka kelimelerin içinde masum geçebilenler: yalnızca tam kelime olarak.
// Bilerek listede OLMAYANLAR: 'am'/'got'/'pic' (İngilizce "I am", "got", "pic"), 'oc' (anime topluluğunda "original character"),
// 'yuri'/'yaoi' (tür adları ve yaygın isim), 'nazi' ('nazik'), 'shit' (Japonca '-shita' isimleri), 'amina' (kadın adı).
const TOKEN_RAW = [
  'amk', 'aq', 'mk', 'sik', 'pust', 'sex', 'sexy', 'xxx', 'dick', 'cock', 'ass', 'cum', 'tit', 'tits', 'hoe', 'fag', 'kys',
  'shit', 'slut', 'rape', 'nude', 'nudes', 'milf', 'boobs', 'pedo', 'loli', 'shota', 'nazi', 'ecchi', 'fuk',
];

const SUBSTRING = [...new Set(SUBSTRING_RAW.map(squash).filter((w) => w.length >= 4))];
/** Tam eşleşme (tekrarlar korunur: "ass", "xxx") ve tekrarı teke indirilmiş eşleşme ("siiik" → "sik"). */
const TOKEN_EXACT = new Set(TOKEN_RAW.map(deleet));
const TOKEN_SQUASHED = new Set(TOKEN_RAW.map(deleet).filter((w) => squash(w) === w));

/**
 * Metin uygunsuz bir ifade içeriyor mu? Kelime kelime bakılır; kelimeler arası birleşmeye bakılmaz
 * ("Habib nefis" → "ibne" sayılmaz). Kullanıcı adında alt çizgiyle ayrılmış parçalar da ayrıca kontrol edilir.
 */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  return tokens(text).some((t) => {
    const exact = deleet(t);
    const squashed = squash(t);
    return TOKEN_EXACT.has(exact) || TOKEN_SQUASHED.has(squashed) || SUBSTRING.some((word) => squashed.includes(word));
  });
}

/** Sistem, yetki ya da site adını taklit eden kullanıcı adları. */
const RESERVED = new Set([
  'admin', 'administrator', 'yonetici', 'moderator', 'mod', 'moderatör', 'staff', 'ekip', 'destek', 'support', 'help', 'yardim',
  'system', 'sistem', 'root', 'official', 'resmi', 'aoikaze', 'aoi_kaze', 'anilist', 'null', 'undefined', 'api', 'giris', 'hesap',
  'listem', 'profil', 'profile', 'settings', 'ayarlar', 'me', 'ben', 'user', 'kullanici', 'anonymous', 'anonim', 'claude',
]);

export const isReservedUsername = (username: string) => {
  const lower = fold(username);
  return RESERVED.has(lower) || RESERVED.has(lower.replace(/_/g, '')) || /^(admin|mod|yonetici|aoikaze)[_\d]/.test(lower);
};

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export type UsernameProblem = 'format' | 'reserved' | 'profanity';

/** Biçim, ayrılmış ad ve küfür kontrolü (benzersizlik ve değiştirme sıklığı veritabanında kontrol edilir). */
export function checkUsername(username: string): UsernameProblem | null {
  if (!USERNAME_PATTERN.test(username) || /^_|_$|__/.test(username)) return 'format';
  if (isReservedUsername(username)) return 'reserved';
  if (containsProfanity(username)) return 'profanity';
  return null;
}
