import { PER_PAGE } from './constants';
import type { BrowseParams, HomeData, Kind, MediaDetail, MediaSummary, Paged, SpotlightItem } from './types';

/**
 * Çevrimdışı küratörlü liste: AniList'e ulaşılamadığında gösterilir.
 * Burada yalnızca GERÇEK eserler ve doğrulanabilir temel bilgiler vardır (ad, yıl, stüdyo, bölüm sayısı, türler,
 * ana karakterler). Kapak, puan ve canlı veri yoktur; özetler ve konsept metinleri bu proje için yazılmıştır.
 * Kimlikler AniList kimlikleridir; canlı veri geldiğinde bu liste hiç kullanılmaz.
 */

type Bilingual<T> = { tr: T; en: T };

interface Entry {
  id: number;
  kind: Kind;
  title: string;
  native: string;
  color: string;
  format: string;
  status: string;
  year: number;
  season?: string;
  episodes?: number;
  chapters?: number;
  volumes?: number;
  duration?: number;
  genres: string[];
  studios: string[];
  characters: string[];
  synopsis: string;
  concept: Bilingual<string>;
  themes: Bilingual<string[]>;
}

const ENTRIES: Entry[] = [
  {
    id: 16498, kind: 'anime', title: 'Attack on Titan', native: '進撃の巨人', color: '#7c4a2d', format: 'TV', status: 'FINISHED', year: 2013, season: 'SPRING', episodes: 25, duration: 24,
    genres: ['Action', 'Drama', 'Fantasy', 'Mystery'], studios: ['Wit Studio'], characters: ['Eren Yeager', 'Mikasa Ackerman', 'Armin Arlert', 'Levi'],
    synopsis: 'Humanity lives behind enormous walls to survive man-eating giants. When a colossal Titan breaches the wall, a young boy vows to destroy every last one of them.',
    concept: { tr: 'Duvarlarla çevrili son sığınakta hayatta kalma, özgürlük ve intikam üzerine karanlık bir aksiyon draması.', en: 'A dark action drama about survival, freedom and revenge inside the last walled refuge of humanity.' },
    themes: { tr: ['Hayatta kalma', 'Özgürlük', 'İntikam', 'Savaşın bedeli'], en: ['Survival', 'Freedom', 'Revenge', 'The cost of war'] },
  },
  {
    id: 101922, kind: 'anime', title: 'Demon Slayer: Kimetsu no Yaiba', native: '鬼滅の刃', color: '#1f6f5c', format: 'TV', status: 'FINISHED', year: 2019, season: 'SPRING', episodes: 26, duration: 23,
    genres: ['Action', 'Adventure', 'Fantasy'], studios: ['ufotable'], characters: ['Tanjiro Kamado', 'Nezuko Kamado', 'Zenitsu Agatsuma', 'Inosuke Hashibira'],
    synopsis: 'After his family is slaughtered and his sister turned into a demon, Tanjiro becomes a demon slayer to find a cure and avenge them.',
    concept: { tr: 'Aile bağı, merhamet ve el yapımı kılıç dövüşleriyle Taisho dönemi Japonyası fantezisi.', en: 'A Taisho-era Japan fantasy built on family bonds, compassion and spectacular sword fights.' },
    themes: { tr: ['Aile', 'Merhamet', 'Kılıç dövüşü', 'Taisho dönemi'], en: ['Family', 'Compassion', 'Swordplay', 'Taisho era'] },
  },
  {
    id: 113415, kind: 'anime', title: 'Jujutsu Kaisen', native: '呪術廻戦', color: '#3b2f8f', format: 'TV', status: 'FINISHED', year: 2020, season: 'FALL', episodes: 24, duration: 24,
    genres: ['Action', 'Supernatural'], studios: ['MAPPA'], characters: ['Yuji Itadori', 'Megumi Fushiguro', 'Nobara Kugisaki', 'Satoru Gojo'],
    synopsis: 'A high schooler swallows a cursed finger to save his friends and is pulled into a hidden world of sorcerers who fight curses born from human fear.',
    concept: { tr: 'İnsan korkusundan doğan lanetlere karşı savaşan büyücülerin modern, hızlı ve stilize dövüş dünyası.', en: 'A modern, fast and stylish fighting world of sorcerers battling curses born from human fear.' },
    themes: { tr: ['Lanetler', 'Dostluk', 'Ölüm korkusu', 'Büyücü okulu'], en: ['Curses', 'Friendship', 'Fear of death', 'Sorcery school'] },
  },
  {
    id: 21, kind: 'anime', title: 'One Piece', native: 'ONE PIECE', color: '#c2410c', format: 'TV', status: 'RELEASING', year: 1999, season: 'FALL', duration: 24,
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'], studios: ['Toei Animation'], characters: ['Monkey D. Luffy', 'Roronoa Zoro', 'Nami', 'Usopp', 'Sanji'],
    synopsis: 'Monkey D. Luffy and his pirate crew sail the Grand Line in search of the legendary treasure known as the One Piece.',
    concept: { tr: 'Efsanevi hazineyi arayan bir korsan ekibinin sonsuz denizlerde geçen, mizah ve duygu dolu macerası.', en: 'An endless sea-faring adventure full of humor and heart, following a pirate crew chasing a legendary treasure.' },
    themes: { tr: ['Macera', 'Hayaller', 'Nakama (dostluk)', 'Özgürlük'], en: ['Adventure', 'Dreams', 'Nakama (found family)', 'Freedom'] },
  },
  {
    id: 20, kind: 'anime', title: 'Naruto', native: 'NARUTO -ナルト-', color: '#d97706', format: 'TV', status: 'FINISHED', year: 2002, season: 'FALL', episodes: 220, duration: 23,
    genres: ['Action', 'Adventure', 'Comedy', 'Supernatural'], studios: ['Pierrot'], characters: ['Naruto Uzumaki', 'Sasuke Uchiha', 'Sakura Haruno', 'Kakashi Hatake'],
    synopsis: 'A young outcast ninja with a monster sealed inside him dreams of becoming the leader of his village and earning everyone’s respect.',
    concept: { tr: 'Dışlanmış bir gencin azim ve dostlukla köyünün lideri olma yolculuğunu anlatan klasik ninja destanı.', en: 'The classic ninja epic of an outcast who earns his village’s respect through grit and friendship.' },
    themes: { tr: ['Azim', 'Dostluk', 'Ninja dünyası', 'Kabul görme'], en: ['Perseverance', 'Friendship', 'Ninja world', 'Acceptance'] },
  },
  {
    id: 1535, kind: 'anime', title: 'Death Note', native: 'DEATH NOTE', color: '#4b1d3f', format: 'TV', status: 'FINISHED', year: 2006, season: 'FALL', episodes: 37, duration: 23,
    genres: ['Mystery', 'Psychological', 'Supernatural', 'Thriller'], studios: ['Madhouse'], characters: ['Light Yagami', 'L', 'Misa Amane', 'Ryuk'],
    synopsis: 'A brilliant student finds a notebook that kills anyone whose name is written in it and decides to remake the world, while a genius detective closes in.',
    concept: { tr: 'İki dahi arasındaki zekâ oyunu; adalet, güç ve ahlak üzerine gerilim dolu bir psikolojik düello.', en: 'A battle of wits between two geniuses: a tense psychological duel about justice, power and morality.' },
    themes: { tr: ['Adalet', 'Zekâ oyunu', 'Güç ve yozlaşma', 'Ahlak'], en: ['Justice', 'Battle of wits', 'Power and corruption', 'Morality'] },
  },
  {
    id: 5114, kind: 'anime', title: 'Fullmetal Alchemist: Brotherhood', native: '鋼の錬金術師 FULLMETAL ALCHEMIST', color: '#a16207', format: 'TV', status: 'FINISHED', year: 2009, season: 'SPRING', episodes: 64, duration: 24,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy'], studios: ['Bones'], characters: ['Edward Elric', 'Alphonse Elric', 'Roy Mustang', 'Winry Rockbell'],
    synopsis: 'Two brothers search for the Philosopher’s Stone to restore the bodies they lost to a forbidden alchemy ritual, uncovering a nation-wide conspiracy.',
    concept: { tr: 'Eşdeğer takas ilkesiyle kurulu bir simya dünyasında kardeşlik, bedel ve devlet sırları.', en: 'Brotherhood, sacrifice and state secrets in a world built on the principle of equivalent exchange.' },
    themes: { tr: ['Kardeşlik', 'Eşdeğer takas', 'Savaş ve vicdan', 'Simya'], en: ['Brotherhood', 'Equivalent exchange', 'War and conscience', 'Alchemy'] },
  },
  {
    id: 1, kind: 'anime', title: 'Cowboy Bebop', native: 'カウボーイビバップ', color: '#1d4ed8', format: 'TV', status: 'FINISHED', year: 1998, season: 'SPRING', episodes: 26, duration: 24,
    genres: ['Action', 'Adventure', 'Drama', 'Sci-Fi'], studios: ['Sunrise'], characters: ['Spike Spiegel', 'Jet Black', 'Faye Valentine', 'Edward'],
    synopsis: 'In 2071, a crew of bounty hunters drifts through the solar system aboard the Bebop, chasing criminals and running from their own pasts.',
    concept: { tr: 'Caz ritmiyle akan, geçmişinden kaçan ödül avcılarının melankolik uzay western’i.', en: 'A melancholic space western with a jazz heartbeat, about bounty hunters running from their pasts.' },
    themes: { tr: ['Geçmişle yüzleşme', 'Caz', 'Uzay western', 'Yalnızlık'], en: ['Facing the past', 'Jazz', 'Space western', 'Loneliness'] },
  },
  {
    id: 9253, kind: 'anime', title: 'Steins;Gate', native: 'STEINS;GATE', color: '#f59e0b', format: 'TV', status: 'FINISHED', year: 2011, season: 'SPRING', episodes: 24, duration: 24,
    genres: ['Drama', 'Sci-Fi', 'Thriller'], studios: ['White Fox'], characters: ['Rintaro Okabe', 'Kurisu Makise', 'Mayuri Shiina', 'Itaru Hashida'],
    synopsis: 'A self-proclaimed mad scientist accidentally discovers a way to send messages to the past and must face the consequences of changing time.',
    concept: { tr: 'Zamanda mesaj göndermenin sonuçlarını işleyen, yavaş yanan ve sürükleyici bir zaman yolculuğu gerilimi.', en: 'A slow-burning, gripping time-travel thriller about the consequences of messaging the past.' },
    themes: { tr: ['Zaman yolculuğu', 'Fedakârlık', 'Kader', 'Bilim kurgu'], en: ['Time travel', 'Sacrifice', 'Fate', 'Science fiction'] },
  },
  {
    id: 21519, kind: 'anime', title: 'Your Name.', native: '君の名は。', color: '#0ea5e9', format: 'MOVIE', status: 'FINISHED', year: 2016, episodes: 1, duration: 106,
    genres: ['Drama', 'Romance', 'Supernatural'], studios: ['CoMix Wave Films'], characters: ['Mitsuha Miyamizu', 'Taki Tachibana'],
    synopsis: 'Two strangers, a country girl and a Tokyo boy, mysteriously swap bodies and begin to form a bond across distance and time.',
    concept: { tr: 'Beden değiştiren iki yabancının mesafe ve zamanı aşan, görsel olarak büyüleyici romantik hikâyesi.', en: 'A visually stunning romance about two strangers who swap bodies and connect across distance and time.' },
    themes: { tr: ['Bağlantı', 'Kader', 'Kayıp', 'Kırsal ve şehir'], en: ['Connection', 'Fate', 'Loss', 'Country and city'] },
  },
  {
    id: 199, kind: 'anime', title: 'Spirited Away', native: '千と千尋の神隠し', color: '#b45309', format: 'MOVIE', status: 'FINISHED', year: 2001, episodes: 1, duration: 125,
    genres: ['Adventure', 'Fantasy', 'Supernatural'], studios: ['Studio Ghibli'], characters: ['Chihiro Ogino', 'Haku', 'No-Face', 'Yubaba'],
    synopsis: 'A ten-year-old girl wanders into a world of spirits and must work in a bathhouse for gods to free her parents and return home.',
    concept: { tr: 'Ruhlar dünyasında büyümeyi, cesareti ve kimliği anlatan Ghibli klasiği.', en: 'A Ghibli classic about growing up, courage and identity in the world of spirits.' },
    themes: { tr: ['Büyümek', 'Cesaret', 'Ruhlar dünyası', 'Kimlik'], en: ['Coming of age', 'Courage', 'Spirit world', 'Identity'] },
  },
  {
    id: 20583, kind: 'anime', title: 'Haikyu!!', native: 'ハイキュー!!', color: '#ea580c', format: 'TV', status: 'FINISHED', year: 2014, season: 'SPRING', episodes: 25, duration: 24,
    genres: ['Comedy', 'Drama', 'Sports'], studios: ['Production I.G'], characters: ['Shoyo Hinata', 'Tobio Kageyama', 'Kei Tsukishima', 'Daichi Sawamura'],
    synopsis: 'Short but determined Hinata joins his high school volleyball club and teams up with his former rival, the prodigy Kageyama.',
    concept: { tr: 'Boyu kısa ama hırsı büyük bir oyuncunun takım ruhuyla yükselişini anlatan enerjik voleybol hikâyesi.', en: 'An energetic volleyball story of a short but fearless player rising through team spirit.' },
    themes: { tr: ['Takım ruhu', 'Rekabet', 'Gelişim', 'Spor'], en: ['Teamwork', 'Rivalry', 'Growth', 'Sports'] },
  },
  {
    id: 101348, kind: 'anime', title: 'Vinland Saga', native: 'ヴィンランド・サガ', color: '#475569', format: 'TV', status: 'FINISHED', year: 2019, season: 'SUMMER', episodes: 24, duration: 25,
    genres: ['Action', 'Adventure', 'Drama'], studios: ['Wit Studio'], characters: ['Thorfinn', 'Askeladd', 'Thorkell', 'Canute'],
    synopsis: 'A young Viking seeks revenge on the mercenary leader who killed his father, only to find that the path of vengeance leads somewhere unexpected.',
    concept: { tr: 'Viking çağında intikam ve barış arasında bir arayış: sert, ağır ve düşündürücü bir tarihi macera.', en: 'A search between revenge and peace in the Viking age: a harsh, weighty and thoughtful historical adventure.' },
    themes: { tr: ['İntikam', 'Barış', 'Viking çağı', 'Kefaret'], en: ['Revenge', 'Peace', 'Viking age', 'Redemption'] },
  },
  {
    id: 127230, kind: 'anime', title: 'Chainsaw Man', native: 'チェンソーマン', color: '#b91c1c', format: 'TV', status: 'FINISHED', year: 2022, season: 'FALL', episodes: 12, duration: 24,
    genres: ['Action', 'Fantasy', 'Horror'], studios: ['MAPPA'], characters: ['Denji', 'Power', 'Makima', 'Aki Hayakawa'],
    synopsis: 'Broke and in debt, Denji merges with his pet devil Pochita and becomes Chainsaw Man, joining a government agency that hunts devils.',
    concept: { tr: 'Şeytan avcılarının dünyasında, sinematik bir görsel dille anlatılan kaotik ve sivri mizahlı bir korku-aksiyon.', en: 'A chaotic horror-action with sharp humor and a cinematic visual language, set among devil hunters.' },
    themes: { tr: ['Şeytanlar', 'Yoksulluk', 'Arzu', 'Kara mizah'], en: ['Devils', 'Poverty', 'Desire', 'Dark humor'] },
  },
  {
    id: 140960, kind: 'anime', title: 'Spy x Family', native: 'SPY×FAMILY', color: '#16a34a', format: 'TV', status: 'FINISHED', year: 2022, season: 'SPRING', episodes: 12, duration: 24,
    genres: ['Action', 'Comedy'], studios: ['Wit Studio', 'CloverWorks'], characters: ['Loid Forger', 'Anya Forger', 'Yor Forger', 'Bond Forger'],
    synopsis: 'A spy, an assassin and a telepathic child form a fake family, each hiding their secret from the others.',
    concept: { tr: 'Birbirinin sırrını bilmeyen bir casus, bir suikastçı ve telepat bir çocuğun sıcak, komik sahte ailesi.', en: 'A warm, funny fake family of a spy, an assassin and a telepathic child who each hide a secret.' },
    themes: { tr: ['Sahte aile', 'Casusluk', 'Komedi', 'Aidiyet'], en: ['Found family', 'Espionage', 'Comedy', 'Belonging'] },
  },
  {
    id: 154587, kind: 'anime', title: 'Frieren: Beyond Journey’s End', native: '葬送のフリーレン', color: '#6d9fb8', format: 'TV', status: 'FINISHED', year: 2023, season: 'FALL', episodes: 28, duration: 24,
    genres: ['Adventure', 'Drama', 'Fantasy'], studios: ['Madhouse'], characters: ['Frieren', 'Fern', 'Stark', 'Himmel'],
    synopsis: 'After the hero’s party defeats the Demon King, the long-lived elf mage Frieren sets out to understand the humans she once traveled with.',
    concept: { tr: 'Macera bittikten sonra başlayan, zaman ve anılar üzerine sakin, hüzünlü bir fantezi yolculuğu.', en: 'A quiet, bittersweet fantasy journey about time and memory that begins after the adventure ends.' },
    themes: { tr: ['Zaman', 'Anılar', 'Kayıp', 'Yolculuk'], en: ['Time', 'Memory', 'Loss', 'Journey'] },
  },
  {
    id: 11061, kind: 'anime', title: 'Hunter x Hunter (2011)', native: 'HUNTER×HUNTER', color: '#15803d', format: 'TV', status: 'FINISHED', year: 2011, season: 'FALL', episodes: 148, duration: 23,
    genres: ['Action', 'Adventure', 'Fantasy'], studios: ['Madhouse'], characters: ['Gon Freecss', 'Killua Zoldyck', 'Kurapika', 'Leorio Paradinight'],
    synopsis: 'Gon sets out to become a Hunter and find his father, meeting friends and dangerous enemies along the way.',
    concept: { tr: 'Zekice kurgulanmış güç sistemi ve dostlukla örülmüş, geniş kapsamlı bir macera.', en: 'A sprawling adventure with a cleverly designed power system and friendships at its core.' },
    themes: { tr: ['Dostluk', 'Güç sistemi (Nen)', 'Macera', 'Ahlaki gri alan'], en: ['Friendship', 'Power system (Nen)', 'Adventure', 'Moral gray areas'] },
  },
  {
    id: 21087, kind: 'anime', title: 'One-Punch Man', native: 'ワンパンマン', color: '#eab308', format: 'TV', status: 'FINISHED', year: 2015, season: 'FALL', episodes: 12, duration: 24,
    genres: ['Action', 'Comedy', 'Sci-Fi'], studios: ['Madhouse'], characters: ['Saitama', 'Genos', 'Mumen Rider', 'Tatsumaki'],
    synopsis: 'Saitama can defeat any enemy with a single punch, but his overwhelming strength has left him bored and searching for a real challenge.',
    concept: { tr: 'Süper kahraman türüyle dalga geçen, aksiyon ve komediyi dengeleyen bir parodi.', en: 'A parody that balances action and comedy while poking fun at the superhero genre.' },
    themes: { tr: ['Parodi', 'Süper kahramanlar', 'Can sıkıntısı', 'Komedi'], en: ['Parody', 'Superheroes', 'Boredom', 'Comedy'] },
  },
  {
    id: 32182, kind: 'anime', title: 'Mob Psycho 100', native: 'モブサイコ100', color: '#a21caf', format: 'TV', status: 'FINISHED', year: 2016, season: 'FALL', episodes: 12, duration: 24,
    genres: ['Action', 'Comedy', 'Supernatural'], studios: ['Bones'], characters: ['Shigeo Kageyama', 'Arataka Reigen', 'Ritsu Kageyama', 'Dimple'],
    synopsis: 'Shigeo "Mob" Kageyama is a middle schooler with immense psychic power who just wants to live an ordinary life and improve himself.',
    concept: { tr: 'Güçlü bir psişik gencin sıradan bir hayat ve kişisel gelişim arayışını anlatan, canlı animasyonlu bir hikâye.', en: 'A vividly animated story of a powerful psychic teen who just wants an ordinary life and personal growth.' },
    themes: { tr: ['Kişisel gelişim', 'Duygular', 'Psişik güçler', 'Mizah'], en: ['Self-improvement', 'Emotions', 'Psychic powers', 'Humor'] },
  },
  {
    id: 151807, kind: 'anime', title: 'Solo Leveling', native: '俺だけレベルアップな件', color: '#2563eb', format: 'TV', status: 'FINISHED', year: 2024, season: 'WINTER', episodes: 12, duration: 24,
    genres: ['Action', 'Adventure', 'Fantasy'], studios: ['A-1 Pictures'], characters: ['Sung Jinwoo', 'Cha Hae-In', 'Go Gunhee', 'Yoo Jinho'],
    synopsis: 'The weakest hunter in a world of dungeons and monsters gains a mysterious system that lets him level up without limit.',
    concept: { tr: 'Zindanlar ve canavarlarla dolu bir dünyada en zayıfın sınırsız güçlenme hikâyesi.', en: 'The story of the weakest hunter gaining limitless power in a world of dungeons and monsters.' },
    themes: { tr: ['Güçlenme', 'Zindanlar', 'Av ve hayatta kalma', 'Oyun mekaniği'], en: ['Power growth', 'Dungeons', 'Hunting and survival', 'Game mechanics'] },
  },
  {
    id: 30002, kind: 'manga', title: 'Berserk', native: 'ベルセルク', color: '#44403c', format: 'MANGA', status: 'RELEASING', year: 1989, volumes: 42,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy', 'Horror'], studios: [], characters: ['Guts', 'Griffith', 'Casca'],
    synopsis: 'Guts, a lone mercenary, wanders a brutal medieval world haunted by demons, driven by betrayal and an unyielding will to survive.',
    concept: { tr: 'Orta çağ esintili, acımasız ve ağır bir karanlık fantezi; ihanet ve azmin hikâyesi.', en: 'A brutal, weighty medieval-inspired dark fantasy about betrayal and unbreakable will.' },
    themes: { tr: ['İhanet', 'Hayatta kalma', 'Karanlık fantezi', 'Kader'], en: ['Betrayal', 'Survival', 'Dark fantasy', 'Fate'] },
  },
  {
    id: 30013, kind: 'manga', title: 'One Piece', native: 'ONE PIECE', color: '#dc2626', format: 'MANGA', status: 'RELEASING', year: 1997,
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'], studios: [], characters: ['Monkey D. Luffy', 'Roronoa Zoro', 'Nami'],
    synopsis: 'The original manga that follows Luffy’s crew across the Grand Line in search of the One Piece treasure.',
    concept: { tr: 'Animenin kaynağı olan ve hâlâ devam eden, dünya çapında en çok satan mangalardan biri.', en: 'The source of the anime and one of the best-selling manga in the world, still running today.' },
    themes: { tr: ['Macera', 'Hayaller', 'Dostluk', 'Özgürlük'], en: ['Adventure', 'Dreams', 'Friendship', 'Freedom'] },
  },
  {
    id: 656, kind: 'manga', title: 'Vagabond', native: 'バガボンド', color: '#57534e', format: 'MANGA', status: 'HIATUS', year: 1998, volumes: 37,
    genres: ['Action', 'Adventure', 'Drama'], studios: [], characters: ['Miyamoto Musashi', 'Sasaki Kojiro', 'Matahachi Hon’iden'],
    synopsis: 'A fictionalized retelling of the life of Miyamoto Musashi, Japan’s legendary swordsman, on his path toward becoming invincible.',
    concept: { tr: 'Efsanevi kılıç ustası Miyamoto Musashi’nin yolculuğunu, mürekkep resimlerini andıran çizimlerle anlatan manga.', en: 'A manga that tells the journey of legendary swordsman Miyamoto Musashi with ink-wash-like artwork.' },
    themes: { tr: ['Kılıç yolu', 'Felsefe', 'Kendini aşma', 'Tarihi kurgu'], en: ['Way of the sword', 'Philosophy', 'Self-overcoming', 'Historical fiction'] },
  },
  {
    id: 105398, kind: 'manhwa', title: 'Solo Leveling', native: '나 혼자만 레벨업', color: '#1e40af', format: 'MANGA', status: 'FINISHED', year: 2018, chapters: 179,
    genres: ['Action', 'Adventure', 'Fantasy'], studios: [], characters: ['Sung Jinwoo', 'Cha Hae-In', 'Yoo Jinho'],
    synopsis: 'The webtoon adaptation of the web novel: E-rank hunter Sung Jinwoo gains the ability to level up alone and rises to become the strongest.',
    concept: { tr: 'Dikey kaydırmalı okuma için tasarlanmış, ayrıntılı çizimleriyle tanınan popüler bir manhwa.', en: 'A popular manhwa built for vertical scrolling and known for its detailed artwork.' },
    themes: { tr: ['Güçlenme', 'Zindanlar', 'Hayatta kalma', 'Webtoon'], en: ['Power growth', 'Dungeons', 'Survival', 'Webtoon'] },
  },
];

/* ------------------------------ Dönüşümler ------------------------------ */

const toSummary = (e: Entry): MediaSummary => ({
  id: e.id,
  kind: e.kind,
  title: e.title,
  titleNative: e.native,
  cover: null,
  color: e.color,
  format: e.format,
  status: e.status,
  year: e.year,
  score: null,
  episodes: e.kind === 'anime' ? e.episodes ?? null : null,
  chapters: e.chapters ?? null,
  genres: e.genres,
});

const byKind = (kind: Kind) => ENTRIES.filter((e) => e.kind === kind);
const loc = (locale: string) => (locale === 'en' ? 'en' : 'tr');

export function curatedHome(): HomeData {
  const anime = byKind('anime');
  const spotlight: SpotlightItem[] = anime
    .slice(0, 6)
    .map((e) => ({ ...toSummary(e), banner: null, description: e.synopsis }));
  return {
    spotlight,
    seasonal: [...anime].sort((a, b) => b.year - a.year).slice(0, 12).map(toSummary),
    topAnime: anime.slice(0, 12).map(toSummary),
    trendingManga: byKind('manga').map(toSummary),
    trendingManhwa: byKind('manhwa').map(toSummary),
    source: 'curated',
  };
}

export function curatedBrowse(params: BrowseParams & { search?: string }): Paged<MediaSummary> {
  const { kind, page = 1, genre, format, status, year, sort = 'popular', search } = params;
  const needle = search?.trim().toLowerCase();
  let list = byKind(kind).filter(
    (e) =>
      (!genre || e.genres.includes(genre)) &&
      (!format || e.format === format) &&
      (!status || e.status === status) &&
      (!year || e.year === year) &&
      (!needle || `${e.title} ${e.native}`.toLowerCase().includes(needle)),
  );
  if (sort === 'new') list = [...list].sort((a, b) => b.year - a.year);
  if (sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
  const lastPage = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const current = Math.min(page, lastPage);
  return {
    items: list.slice((current - 1) * PER_PAGE, current * PER_PAGE).map(toSummary),
    page: current,
    lastPage,
    total: list.length,
    source: 'curated',
  };
}

export function curatedSearch(query: string): MediaSummary[] {
  const needle = query.trim().toLowerCase();
  return ENTRIES.filter((e) => `${e.title} ${e.native}`.toLowerCase().includes(needle)).slice(0, 10).map(toSummary);
}

export function curatedDetail(id: number, locale: string): MediaDetail | null {
  const entry = ENTRIES.find((e) => e.id === id);
  if (!entry) return null;
  const l = loc(locale);
  const type = entry.kind === 'anime' ? 'anime' : 'manga';
  const q = encodeURIComponent(entry.title);
  return {
    ...toSummary(entry),
    banner: null,
    description: entry.synopsis,
    season: entry.season ?? null,
    duration: entry.duration ?? null,
    volumes: entry.volumes ?? null,
    popularity: null,
    studios: entry.studios,
    trailerId: null,
    watchLinks:
      entry.kind === 'anime'
        ? [
            { site: 'Crunchyroll', url: `https://www.crunchyroll.com/search?q=${q}` },
            { site: 'Netflix', url: `https://www.netflix.com/search?q=${q}` },
            { site: 'AniList', url: `https://anilist.co/${type}/${entry.id}` },
          ]
        : [
            entry.kind === 'manhwa'
              ? { site: 'WEBTOON', url: `https://www.webtoons.com/en/search?keyword=${q}` }
              : { site: 'MANGA Plus', url: `https://mangaplus.shueisha.co.jp/search_result?keyword=${q}` },
            { site: 'AniList', url: `https://anilist.co/${type}/${entry.id}` },
          ],
    characters: entry.characters.map((name) => ({ name, image: null, role: null })),
    tags: [],
    episodeList: [],
    concept: entry.concept[l],
    themes: entry.themes[l],
    recommendations: ENTRIES.filter((e) => e.id !== entry.id && e.kind === entry.kind && e.genres.some((g) => entry.genres.includes(g)))
      .slice(0, 6)
      .map(toSummary),
    nextEpisode: null,
    source: 'curated',
  };
}
