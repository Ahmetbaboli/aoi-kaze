export type Kind = 'anime' | 'manga' | 'manhwa';

/** anilist: canlı veri · curated: çevrimdışı küratörlü liste (gerçek eserler, kapak/puan yok) · unavailable: veri yok */
export type DataSource = 'anilist' | 'curated' | 'unavailable';

export interface MediaSummary {
  id: number;
  kind: Kind;
  title: string;
  titleNative: string | null;
  /** Kapak görseli URL'si; kaynakta yoksa null (CSS ile çizilir) */
  cover: string | null;
  /** Kapağın baskın rengi (#hex) */
  color: string | null;
  format: string | null;
  status: string | null;
  year: number | null;
  /** 0-100 */
  score: number | null;
  episodes: number | null;
  chapters: number | null;
  genres: string[];
}

export interface MediaDetail extends MediaSummary {
  banner: string | null;
  description: string;
  season: string | null;
  duration: number | null;
  volumes: number | null;
  popularity: number | null;
  studios: string[];
  /** YouTube video kimliği */
  trailerId: string | null;
  /** Yalnızca resmi izleme/okuma platformları */
  watchLinks: { site: string; url: string }[];
  /** id ve voiceActor yalnızca canlı (AniList) veride bulunur; küratörlü listede yoktur. */
  characters: { id?: number; name: string; image: string | null; role: string | null; voiceActor?: PersonRef | null }[];
  /** Bağlantılı stüdyolar (yalnızca canlı veride) */
  studioLinks?: { id: number; name: string }[];
  /** Spoiler içermeyen etiketler (konsept ve temalar) */
  tags: { name: string; rank: number | null }[];
  /** Resmî platformlardaki bölümler (başlık, küçük görsel ve dış bağlantı) */
  episodeList: { title: string; thumbnail: string | null; url: string; site: string }[];
  /** Yalnızca küratörlü listede: kısa konsept metni ve tema başlıkları (dile göre) */
  concept?: string;
  themes?: string[];
  recommendations: MediaSummary[];
  nextEpisode: { episode: number; airingAt: number } | null;
  source: DataSource;
}

export interface SpotlightItem extends MediaSummary {
  banner: string | null;
  description: string;
}

export interface HomeData {
  spotlight: SpotlightItem[];
  seasonal: MediaSummary[];
  topAnime: MediaSummary[];
  trendingManga: MediaSummary[];
  trendingManhwa: MediaSummary[];
  source: DataSource;
}

export interface Paged<T> {
  items: T[];
  page: number;
  lastPage: number;
  total: number;
  source: DataSource;
}

export type SortKey = 'popular' | 'score' | 'trending' | 'new' | 'title';

export interface BrowseParams {
  kind: Kind;
  page?: number;
  genre?: string;
  format?: string;
  status?: string;
  year?: number;
  sort?: SortKey;
}

export interface ScheduleEntry {
  airingAt: number;
  episode: number;
  media: MediaSummary;
}

/** Kişi (seslendiren / yapım ekibi) bağlantısı */
export interface PersonRef {
  id: number;
  name: string;
  image: string | null;
}

/** Biyografi: AniList açıklamalarındaki ~!spoiler!~ blokları ayrı tutulur (tıklayınca açılır). */
export type { RichText } from './rich-text';
import type { RichText } from './rich-text';

export interface PersonFacts {
  gender: string | null;
  age: string | null;
  /** { month, day, year? } */
  birthday: { year: number | null; month: number | null; day: number | null } | null;
  favourites: number | null;
}

export interface CharacterDetail extends PersonFacts {
  id: number;
  name: string;
  nameNative: string | null;
  alternative: string[];
  image: string | null;
  bloodType: string | null;
  /** Açıklamanın başındaki 'Boy: 170 cm' gibi bilgi satırları */
  facts: { label: string; value: string }[];
  description: RichText;
  appearances: { media: MediaSummary; role: string | null }[];
  voiceActors: (PersonRef & { language: string | null })[];
}

export interface StaffDetail extends PersonFacts {
  id: number;
  name: string;
  nameNative: string | null;
  image: string | null;
  description: RichText;
  occupations: string[];
  homeTown: string | null;
  yearsActive: number[];
  language: string | null;
  /** Seslendirdiği karakterler (eserle birlikte) */
  roles: { character: PersonRef; media: MediaSummary | null; role: string | null }[];
  /** Yapım ekibi görevleri (yönetmen, mangaka...) */
  works: { media: MediaSummary; role: string | null }[];
}

export interface StudioDetail {
  id: number;
  name: string;
  isAnimationStudio: boolean;
  favourites: number | null;
  media: MediaSummary[];
}

export interface BirthdayCharacter {
  id: number;
  name: string;
  image: string | null;
  /** En popüler eseri (adı ve rengi kartta gösterilir) */
  media: { title: string; color: string | null } | null;
}
