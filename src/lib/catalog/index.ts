import {
  fetchBirthdays,
  fetchBrowse,
  fetchCharacter,
  fetchDetail,
  fetchHome,
  fetchMediaImages,
  fetchSchedule,
  fetchSearch,
  fetchStaff,
  fetchStudio,
  type MediaImages,
} from './anilist';
import { curatedBrowse, curatedDetail, curatedHome, curatedSearch } from './curated';
import type { BrowseParams, HomeData, MediaDetail, MediaSummary, Paged, ScheduleEntry } from './types';

export * from './constants';
export type * from './types';

/**
 * Katalog verisi için tek giriş noktası. Veri AniList'ten gelir. Ulaşılamazsa küratörlü listeye
 * (yalnızca gerçek eserler; kapak ve canlı puan yok) düşer ve `source: 'curated'` döner; sayfalar
 * bunu açık bir uyarıyla gösterir. Bir hata olursa 60 sn boyunca canlı istek denenmez (her sayfa
 * tekrar tekrar zaman aşımı beklemesin diye). ANILIST_ENABLED=false canlı veriyi tamamen kapatır.
 */
const BREAKER_MS = 60_000;
let downUntil = 0;

const liveEnabled = () => process.env.ANILIST_ENABLED !== 'false' && Date.now() > downUntil;

async function attempt<T>(live: () => Promise<T>, fallback: () => T): Promise<T> {
  if (!liveEnabled()) return fallback();
  try {
    return await live();
  } catch (error) {
    downUntil = Date.now() + BREAKER_MS;
    console.warn('[katalog] AniList kullanılamadı:', (error as Error).message);
    return fallback();
  }
}

export const getHome = (): Promise<HomeData> => attempt(fetchHome, curatedHome);

export const browse = (params: BrowseParams & { search?: string }): Promise<Paged<MediaSummary>> =>
  attempt(() => fetchBrowse(params), () => curatedBrowse(params));

export const search = (query: string): Promise<MediaSummary[]> =>
  attempt(() => fetchSearch(query), () => curatedSearch(query));

export type DetailResult = { status: 'ok'; media: MediaDetail } | { status: 'missing' } | { status: 'unavailable' };

export const getDetail = (id: number, locale = 'tr'): Promise<DetailResult> =>
  attempt<DetailResult>(
    async () => {
      const media = await fetchDetail(id);
      return media ? { status: 'ok', media } : { status: 'missing' };
    },
    () => {
      const media = curatedDetail(id, locale);
      return media ? { status: 'ok', media } : { status: 'unavailable' };
    },
  );

/** Yayın takvimi canlı veri gerektirir; ulaşılamazsa `null`. */
export const getSchedule = (from: number, to: number): Promise<ScheduleEntry[] | null> =>
  attempt<ScheduleEntry[] | null>(() => fetchSchedule(from, to), () => null);

export type { MediaImages };

/** Profil avatarı/banner'ı için +18 olmayan eserlerin görselleri; ulaşılamazsa `null`. */
export const getMediaImages = (ids: number[]): Promise<MediaImages[] | null> =>
  attempt<MediaImages[] | null>(() => fetchMediaImages(ids), () => null);

export type LookupResult<T> = { status: 'ok'; data: T } | { status: 'missing' } | { status: 'unavailable' };

/** Karakter / kişi / stüdyo sayfaları: bulunamazsa 'missing' (404), AniList'e ulaşılamazsa 'unavailable' (uyarı). */
const lookup = <T>(fetcher: () => Promise<T | null>): Promise<LookupResult<T>> =>
  attempt<LookupResult<T>>(
    async () => {
      const data = await fetcher();
      return data ? { status: 'ok', data } : { status: 'missing' };
    },
    () => ({ status: 'unavailable' }),
  );

export const getCharacter = (id: number) => lookup(() => fetchCharacter(id));
export const getStaff = (id: number) => lookup(() => fetchStaff(id));
export const getStudio = (id: number) => lookup(() => fetchStudio(id));

/** Ana sayfadaki "bugün doğum günü olanlar" şeridi; ulaşılamazsa boş (şerit gizlenir). */
export const getBirthdays = () => attempt(fetchBirthdays, () => []);
