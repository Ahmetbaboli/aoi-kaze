import { PER_PAGE } from './constants';
import type {
  BrowseParams,
  HomeData,
  Kind,
  MediaDetail,
  MediaSummary,
  Paged,
  ScheduleEntry,
  SortKey,
  SpotlightItem,
  PersonRef,
  CharacterDetail,
  StaffDetail,
  StudioDetail,
  BirthdayCharacter,
} from './types';
import { parseRichText, splitFacts } from './rich-text';
import type { PuzzleData } from '@/lib/game/game-core';

const ENDPOINT = 'https://graphql.anilist.co';
const REVALIDATE_SECONDS = 3600;
const TIMEOUT_MS = 8000;

/* ------------------------------ GraphQL ------------------------------ */

const SUMMARY = `
  fragment Summary on Media {
    id type countryOfOrigin
    title { romaji english native }
    coverImage { extraLarge large color }
    format status seasonYear startDate { year }
    averageScore episodes chapters genres
  }
`;

const SORT_ENUM: Record<SortKey, string> = {
  popular: 'POPULARITY_DESC',
  score: 'SCORE_DESC',
  trending: 'TRENDING_DESC',
  new: 'START_DATE_DESC',
  title: 'TITLE_ROMAJI',
};

interface RawMedia {
  id: number;
  type: 'ANIME' | 'MANGA';
  countryOfOrigin?: string | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage?: { extraLarge: string | null; large: string | null; color: string | null } | null;
  bannerImage?: string | null;
  description?: string | null;
  format?: string | null;
  status?: string | null;
  seasonYear?: number | null;
  startDate?: { year: number | null } | null;
  averageScore?: number | null;
  episodes?: number | null;
  chapters?: number | null;
  genres?: string[] | null;
  isAdult?: boolean;
}

interface RawPage {
  pageInfo?: { total: number; currentPage: number; lastPage: number };
  media: RawMedia[];
}

/** Geçici hatada bekleme süreleri (ms). Uzunluğu yeniden deneme sayısıdır: toplam 3 deneme. */
const RETRY_DELAYS = [400, 1200];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Geçici hatalarda (ağ kopması / bağlantı sıfırlanması, 429, 5xx) artan aralıklarla yeniden dener.
 * Kurumsal ağlarda bağlantı birkaç yüz ms kopabiliyor; beklemeden yapılan tek tekrar çoğu zaman aynı kopmaya düşer.
 * 429/5xx'te Retry-After varsa ona uyulur (en fazla 2 sn). Zaman aşımı (8 sn) yeniden denenmez: sayfa çok uzun beklemesin.
 */
async function request(query: string, variables: Record<string, unknown>): Promise<Response> {
  const send = () =>
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  for (let attempt = 0; ; attempt++) {
    const last = attempt >= RETRY_DELAYS.length;
    let response: Response;
    try {
      response = await send();
    } catch (error) {
      if (last || (error as Error)?.name === 'TimeoutError') throw error;
      await sleep(RETRY_DELAYS[attempt]);
      continue;
    }
    if (last || (response.status !== 429 && response.status < 500)) return response;
    const retryAfter = Number(response.headers.get('Retry-After'));
    await sleep(retryAfter > 0 ? Math.min(retryAfter, 2) * 1000 : RETRY_DELAYS[attempt]);
  }
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await request(query, variables);
  if (response.status === 404) throw new Error('AniList: not found');
  if (!response.ok) throw new Error(`AniList HTTP ${response.status}`);
  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length || !json.data) throw new Error(json.errors?.[0]?.message ?? 'AniList boş yanıt');
  return json.data;
}

/* ------------------------------ Dönüşümler ------------------------------ */

const kindOf = (media: RawMedia): Kind =>
  media.type === 'ANIME' ? 'anime' : media.countryOfOrigin === 'KR' ? 'manhwa' : 'manga';

export function toSummary(media: RawMedia): MediaSummary {
  return {
    id: media.id,
    kind: kindOf(media),
    title: media.title.english ?? media.title.romaji ?? media.title.native ?? `#${media.id}`,
    titleNative: media.title.native,
    cover: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    color: media.coverImage?.color ?? null,
    format: media.format ?? null,
    status: media.status ?? null,
    year: media.seasonYear ?? media.startDate?.year ?? null,
    score: media.averageScore ?? null,
    episodes: media.episodes ?? null,
    chapters: media.chapters ?? null,
    genres: media.genres ?? [],
  };
}

/** AniList açıklamaları basit HTML içerir: etiketleri temizleyip düz metne çevirir. */
export function cleanDescription(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const safeHttps = (url: string) => /^https:\/\//i.test(url);

interface RawPerson {
  id: number;
  name: { userPreferred: string | null; full?: string | null; native?: string | null };
  image?: { medium?: string | null; large?: string | null } | null;
  languageV2?: string | null;
}

const toPerson = (p: RawPerson): PersonRef => ({
  id: p.id,
  name: p.name.userPreferred ?? p.name.full ?? `#${p.id}`,
  image: p.image?.large ?? p.image?.medium ?? null,
});

/* ------------------------------ Sorgular ------------------------------ */

function currentSeason(date = new Date()) {
  const month = date.getMonth();
  const season = month < 3 ? 'WINTER' : month < 6 ? 'SPRING' : month < 9 ? 'SUMMER' : 'FALL';
  return { season, year: date.getFullYear() };
}

export async function fetchHome(): Promise<HomeData> {
  const { season, year } = currentSeason();
  const data = await gql<Record<'trending' | 'seasonal' | 'top' | 'manga' | 'manhwa', RawPage>>(
    `${SUMMARY}
    query ($season: MediaSeason, $year: Int) {
      trending: Page(perPage: 12) { media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ...Summary bannerImage description } }
      seasonal: Page(perPage: 12) { media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC, isAdult: false) { ...Summary } }
      top: Page(perPage: 12) { media(type: ANIME, sort: SCORE_DESC, isAdult: false) { ...Summary } }
      manga: Page(perPage: 12) { media(type: MANGA, countryOfOrigin: "JP", sort: TRENDING_DESC, isAdult: false) { ...Summary } }
      manhwa: Page(perPage: 12) { media(type: MANGA, countryOfOrigin: "KR", sort: TRENDING_DESC, isAdult: false) { ...Summary } }
    }`,
    { season, year },
  );

  const spotlight: SpotlightItem[] = data.trending.media
    .filter((m) => m.bannerImage)
    .slice(0, 5)
    .map((m) => ({ ...toSummary(m), banner: m.bannerImage ?? null, description: cleanDescription(m.description) }));

  return {
    spotlight,
    seasonal: data.seasonal.media.map(toSummary),
    topAnime: data.top.media.map(toSummary),
    trendingManga: data.manga.media.map(toSummary),
    trendingManhwa: data.manhwa.media.map(toSummary),
    source: 'anilist',
  };
}

export async function fetchBrowse(params: BrowseParams & { search?: string }): Promise<Paged<MediaSummary>> {
  const { kind, page = 1, genre, format, status, year, sort = 'popular', search } = params;
  const data = await gql<{ Page: RawPage }>(
    `${SUMMARY}
    query ($page: Int, $perPage: Int, $type: MediaType, $country: CountryCode, $genre: String, $format: MediaFormat,
           $status: MediaStatus, $year: String, $sort: [MediaSort], $search: String) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage }
        media(type: $type, countryOfOrigin: $country, genre: $genre, format: $format, status: $status,
              startDate_like: $year, sort: $sort, search: $search, isAdult: false) { ...Summary }
      }
    }`,
    {
      page,
      perPage: PER_PAGE,
      type: kind === 'anime' ? 'ANIME' : 'MANGA',
      country: kind === 'manga' ? 'JP' : kind === 'manhwa' ? 'KR' : undefined,
      genre,
      format,
      status,
      year: year ? `${year}%` : undefined,
      sort: [search ? 'SEARCH_MATCH' : SORT_ENUM[sort]],
      search,
    },
  );

  return {
    items: data.Page.media.map(toSummary),
    page: data.Page.pageInfo?.currentPage ?? page,
    lastPage: data.Page.pageInfo?.lastPage ?? 1,
    total: data.Page.pageInfo?.total ?? data.Page.media.length,
    source: 'anilist',
  };
}

export async function fetchSearch(query: string): Promise<MediaSummary[]> {
  const data = await gql<{ Page: RawPage }>(
    `${SUMMARY}
    query ($q: String) {
      Page(perPage: 10) { media(search: $q, sort: SEARCH_MATCH, isAdult: false) { ...Summary } }
    }`,
    { q: query },
  );
  return data.Page.media.map(toSummary);
}

export async function fetchDetail(id: number): Promise<MediaDetail | null> {
  const data = await gql<{
    Media:
      | (RawMedia & {
          season: string | null;
          duration: number | null;
          volumes: number | null;
          popularity: number | null;
          studios: { nodes: { id: number; name: string }[] };
          trailer: { id: string; site: string } | null;
          externalLinks: { site: string; url: string; type: string }[];
          characters: {
            edges: {
              role: string | null;
              node: { id: number; name: { userPreferred: string }; image: { medium: string | null } | null };
              voiceActors: RawPerson[];
            }[];
          };
          tags: { name: string; rank: number | null; isMediaSpoiler: boolean; isGeneralSpoiler: boolean }[];
          streamingEpisodes: { title: string | null; thumbnail: string | null; url: string | null; site: string | null }[];
          recommendations: { nodes: { mediaRecommendation: RawMedia | null }[] };
          nextAiringEpisode: { episode: number; airingAt: number } | null;
        })
      | null;
  }>(
    `${SUMMARY}
    query ($id: Int) {
      Media(id: $id) {
        ...Summary isAdult bannerImage description(asHtml: false) season duration volumes popularity
        studios(isMain: true) { nodes { id name } }
        trailer { id site }
        externalLinks { site url type }
        characters(perPage: 12, sort: [ROLE, RELEVANCE]) {
          edges { role node { id name { userPreferred } image { medium } } voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) { id name { userPreferred } image { medium } } }
        }
        tags { name rank isMediaSpoiler isGeneralSpoiler }
        streamingEpisodes { title thumbnail url site }
        recommendations(perPage: 6, sort: RATING_DESC) { nodes { mediaRecommendation { ...Summary isAdult } } }
        nextAiringEpisode { episode airingAt }
      }
    }`,
    { id },
  ).catch((error: Error) => {
    // AniList var olmayan kimlik için hata döndürür: bunu "bulunamadı" say.
    if (/not found/i.test(error.message)) return { Media: null };
    throw error;
  });

  const media = data.Media;
  if (!media || media.isAdult) return null;

  return {
    ...toSummary(media),
    banner: media.bannerImage ?? null,
    description: cleanDescription(media.description),
    season: media.season,
    duration: media.duration,
    volumes: media.volumes,
    popularity: media.popularity,
    studios: media.studios.nodes.map((n) => n.name),
    studioLinks: media.studios.nodes.map(({ id, name }) => ({ id, name })),
    trailerId: media.trailer?.site === 'youtube' ? media.trailer.id : null,
    watchLinks: media.externalLinks.filter((l) => l.type === 'STREAMING' && safeHttps(l.url)).map(({ site, url }) => ({ site, url })),
    characters: media.characters.edges.map((e) => ({
      id: e.node.id,
      name: e.node.name.userPreferred,
      image: e.node.image?.medium ?? null,
      role: e.role,
      voiceActor: e.voiceActors[0] ? toPerson(e.voiceActors[0]) : null,
    })),
    tags: media.tags
      .filter((tag) => !tag.isMediaSpoiler && !tag.isGeneralSpoiler)
      .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
      .slice(0, 10)
      .map(({ name, rank }) => ({ name, rank })),
    episodeList: media.streamingEpisodes
      .filter((e): e is typeof e & { title: string; url: string } => !!e.title && !!e.url && safeHttps(e.url))
      .slice(0, 24)
      .map((e) => ({ title: e.title, thumbnail: e.thumbnail, url: e.url, site: e.site ?? '' })),
    recommendations: media.recommendations.nodes
      .map((n) => n.mediaRecommendation)
      .filter((m): m is RawMedia => !!m && !m.isAdult)
      .map(toSummary),
    nextEpisode: media.nextAiringEpisode,
    source: 'anilist',
  };
}

export async function fetchSchedule(from: number, to: number): Promise<ScheduleEntry[]> {
  const pages = await Promise.all(
    [1, 2, 3].map((page) =>
      gql<{ Page: { airingSchedules: { airingAt: number; episode: number; media: RawMedia }[] } }>(
        `${SUMMARY}
        query ($page: Int, $from: Int, $to: Int) {
          Page(page: $page, perPage: 50) {
            airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
              airingAt episode media { ...Summary isAdult }
            }
          }
        }`,
        { page, from, to },
      ),
    ),
  );

  return pages
    .flatMap((p) => p.Page.airingSchedules)
    .filter((entry) => !entry.media.isAdult && entry.media.countryOfOrigin === 'JP')
    .map((entry) => ({ airingAt: entry.airingAt, episode: entry.episode, media: toSummary(entry.media) }));
}

export interface MediaImages {
  id: number;
  title: string;
  cover: string | null;
  banner: string | null;
}

/**
 * Profil avatarı/banner'ı için eser görselleri. +18 işaretli eserler hiç dönmez (sorguda isAdult: false ve
 * yanıtta ayrıca kontrol): kullanıcı bir eser kimliği seçer, görselin adresini sunucu buradan alır.
 */
export async function fetchMediaImages(ids: number[]): Promise<MediaImages[]> {
  const unique = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 50);
  if (unique.length === 0) return [];
  const data = await gql<{ Page: { media: (RawMedia & { bannerImage: string | null })[] } }>(
    `query ($ids: [Int]) {
      Page(perPage: 50) {
        media(id_in: $ids, isAdult: false) {
          id isAdult title { romaji english native } coverImage { extraLarge large color } bannerImage
        }
      }
    }`,
    { ids: unique },
  );
  return data.Page.media
    .filter((m) => !m.isAdult)
    .map((m) => ({
      id: m.id,
      title: m.title.english ?? m.title.romaji ?? m.title.native ?? `#${m.id}`,
      cover: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
      banner: m.bannerImage ?? null,
    }));
}

/* ------------------------------ Karakter, kişi, stüdyo ------------------------------ */

/** AniList var olmayan kimlik için hata döndürür: bunu "bulunamadı" (null) say. */
const orMissing = <T>(error: Error, empty: T): T => {
  if (/not found/i.test(error.message)) return empty;
  throw error;
};

type RawDate = { year: number | null; month: number | null; day: number | null } | null;
const toBirthday = (d: RawDate) => (d && (d.month || d.year) ? { year: d.year, month: d.month, day: d.day } : null);

export async function fetchCharacter(id: number): Promise<CharacterDetail | null> {
  const data = await gql<{
    Character:
      | (RawPerson & {
          name: { full: string | null; native: string | null; alternative: string[] | null; userPreferred: string | null };
          description: string | null;
          gender: string | null;
          age: string | null;
          bloodType: string | null;
          dateOfBirth: RawDate;
          favourites: number | null;
          media: { edges: { characterRole: string | null; node: RawMedia; voiceActors: RawPerson[] }[] };
        })
      | null;
  }>(
    `${SUMMARY}
    query ($id: Int) {
      Character(id: $id) {
        id name { full native alternative userPreferred } image { large }
        description(asHtml: false) gender age bloodType dateOfBirth { year month day } favourites
        media(perPage: 25, sort: [POPULARITY_DESC]) {
          edges {
            characterRole
            node { ...Summary isAdult }
            voiceActors(sort: [RELEVANCE, ID]) { id name { userPreferred } image { medium } languageV2 }
          }
        }
      }
    }`,
    { id },
  ).catch((error: Error) => orMissing(error, { Character: null }));

  const c = data.Character;
  if (!c) return null;
  const edges = c.media.edges.filter((e) => !e.node.isAdult);
  // Yalnızca +18 eserlerde geçen karakter gösterilmez.
  if (c.media.edges.length > 0 && edges.length === 0) return null;

  // Seslendirenler: önce Japonca, sonra İngilizce, sonra diğer diller; her kişi bir kez.
  const seen = new Set<number>();
  const order = (lang: string | null | undefined) => (lang === 'Japanese' ? 0 : lang === 'English' ? 1 : 2);
  const voiceActors = edges
    .flatMap((e) => e.voiceActors)
    .sort((a, b) => order(a.languageV2) - order(b.languageV2))
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .slice(0, 8)
    .map((p) => ({ ...toPerson(p), language: p.languageV2 ?? null }));

  const { facts, body } = splitFacts(c.description);
  return {
    id: c.id,
    name: c.name.userPreferred ?? c.name.full ?? `#${c.id}`,
    nameNative: c.name.native,
    alternative: (c.name.alternative ?? []).filter(Boolean).slice(0, 6),
    image: c.image?.large ?? null,
    gender: c.gender,
    age: c.age,
    bloodType: c.bloodType,
    birthday: toBirthday(c.dateOfBirth),
    favourites: c.favourites,
    facts,
    description: parseRichText(body),
    appearances: edges.map((e) => ({ media: toSummary(e.node), role: e.characterRole })),
    voiceActors,
  };
}

export async function fetchStaff(id: number): Promise<StaffDetail | null> {
  const data = await gql<{
    Staff:
      | (RawPerson & {
          name: { full: string | null; native: string | null; userPreferred: string | null };
          description: string | null;
          primaryOccupations: string[] | null;
          gender: string | null;
          age: number | null;
          dateOfBirth: RawDate;
          homeTown: string | null;
          yearsActive: number[] | null;
          favourites: number | null;
          characters: { edges: { role: string | null; node: RawPerson; media: RawMedia[] }[] };
          staffMedia: { edges: { staffRole: string | null; node: RawMedia }[] };
        })
      | null;
  }>(
    `${SUMMARY}
    query ($id: Int) {
      Staff(id: $id) {
        id name { full native userPreferred } image { large } languageV2
        description(asHtml: false) primaryOccupations gender age dateOfBirth { year month day } homeTown yearsActive favourites
        characters(perPage: 24, sort: [FAVOURITES_DESC]) { edges { role node { id name { userPreferred } image { medium } } media { ...Summary isAdult } } }
        staffMedia(perPage: 18, sort: [POPULARITY_DESC]) { edges { staffRole node { ...Summary isAdult } } }
      }
    }`,
    { id },
  ).catch((error: Error) => orMissing(error, { Staff: null }));

  const p = data.Staff;
  if (!p) return null;
  const roles = p.characters.edges
    .map((e) => ({ edge: e, media: e.media.find((m) => !m.isAdult) ?? null }))
    // Yalnızca +18 eserlerdeki roller listelenmez.
    .filter(({ edge, media }) => media || edge.media.length === 0)
    .map(({ edge, media }) => ({ character: toPerson(edge.node), media: media ? toSummary(media) : null, role: edge.role }));
  // Aynı eser birden çok görevle gelebilir: görevleri birleştir.
  const works = new Map<number, { media: MediaSummary; role: string | null }>();
  for (const e of p.staffMedia.edges) {
    if (e.node.isAdult) continue;
    const prev = works.get(e.node.id);
    works.set(e.node.id, { media: toSummary(e.node), role: prev?.role && e.staffRole ? `${prev.role}, ${e.staffRole}` : (e.staffRole ?? prev?.role ?? null) });
  }

  return {
    id: p.id,
    name: p.name.userPreferred ?? p.name.full ?? `#${p.id}`,
    nameNative: p.name.native,
    image: p.image?.large ?? null,
    gender: p.gender,
    age: p.age != null ? String(p.age) : null,
    birthday: toBirthday(p.dateOfBirth),
    favourites: p.favourites,
    description: parseRichText(p.description),
    occupations: (p.primaryOccupations ?? []).slice(0, 5),
    homeTown: p.homeTown,
    yearsActive: p.yearsActive ?? [],
    language: p.languageV2 ?? null,
    roles,
    works: [...works.values()],
  };
}

export async function fetchStudio(id: number): Promise<StudioDetail | null> {
  const data = await gql<{
    Studio: { id: number; name: string; isAnimationStudio: boolean; favourites: number | null; media: { nodes: RawMedia[] } } | null;
  }>(
    `${SUMMARY}
    query ($id: Int) {
      Studio(id: $id) {
        id name isAnimationStudio favourites
        media(sort: [POPULARITY_DESC], perPage: 30, isMain: true) { nodes { ...Summary isAdult } }
      }
    }`,
    { id },
  ).catch((error: Error) => orMissing(error, { Studio: null }));

  const st = data.Studio;
  if (!st) return null;
  return {
    id: st.id,
    name: st.name,
    isAnimationStudio: st.isAnimationStudio,
    favourites: st.favourites,
    media: st.media.nodes.filter((m) => !m.isAdult).map(toSummary),
  };
}

/** Bugün doğum günü olan, en sevilen karakterler (en popüler eseri +18 olanlar atlanır). */
export async function fetchBirthdays(): Promise<BirthdayCharacter[]> {
  const data = await gql<{
    Page: { characters: (RawPerson & { media: { nodes: RawMedia[] } })[] };
  }>(
    `query {
      Page(perPage: 16) {
        characters(isBirthday: true, sort: [FAVOURITES_DESC]) {
          id name { userPreferred } image { large }
          media(perPage: 1, sort: [POPULARITY_DESC]) { nodes { id isAdult type countryOfOrigin title { romaji english native } coverImage { color } } }
        }
      }
    }`,
  );
  return data.Page.characters
    .filter((c) => c.media.nodes.length > 0 && !c.media.nodes[0].isAdult)
    .slice(0, 12)
    .map((c) => {
      const m = c.media.nodes[0];
      return {
        id: c.id,
        name: c.name.userPreferred ?? `#${c.id}`,
        image: c.image?.large ?? null,
        media: { title: m.title.english ?? m.title.romaji ?? m.title.native ?? '', color: m.coverImage?.color ?? null },
      };
    });
}

/* ------------------------------ Mini oyun ------------------------------ */

/**
 * Günlük Tahmin adayları: popülerlik sırasıyla TV/film animeleri (+18 hariç). İpuçları buradan hazırlanır;
 * spoiler etiketleri ve kısa/özel formatlar elenir. Sayfa 1-tabanlıdır, sayfa başına 50 eser.
 */
export async function fetchGameCandidates(page: number): Promise<PuzzleData[]> {
  const data = await gql<{
    Page: {
      media: (RawMedia & {
        studios: { nodes: { name: string }[] };
        tags: { name: string; rank: number | null; isMediaSpoiler: boolean; isGeneralSpoiler: boolean }[];
        characters: { nodes: { name: { userPreferred: string | null } }[] };
      })[];
    };
  }>(
    `${SUMMARY}
    query ($page: Int) {
      Page(page: $page, perPage: 50) {
        media(type: ANIME, sort: [POPULARITY_DESC], isAdult: false, format_in: [TV, MOVIE]) {
          ...Summary isAdult
          studios(isMain: true) { nodes { name } }
          tags { name rank isMediaSpoiler isGeneralSpoiler }
          characters(perPage: 1, sort: [ROLE, RELEVANCE]) { nodes { name { userPreferred } } }
        }
      }
    }`,
    { page },
  );
  return data.Page.media
    .filter((m) => !m.isAdult)
    .map((m) => {
      const s = toSummary(m);
      return {
        answer: { id: s.id, title: s.title, titleNative: s.titleNative, cover: s.cover, color: s.color },
        clues: {
          basics: { format: s.format, year: s.year, episodes: s.episodes },
          genres: s.genres,
          studio: m.studios.nodes[0]?.name ?? null,
          tags: m.tags
            .filter((t) => !t.isMediaSpoiler && !t.isGeneralSpoiler)
            .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))
            .slice(0, 3)
            .map((t) => t.name),
          cover: s.cover,
          character: m.characters.nodes[0]?.name.userPreferred ?? null,
        },
      };
    });
}
