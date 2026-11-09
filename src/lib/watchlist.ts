'use client';

import { useSyncExternalStore } from 'react';
import type { Kind, MediaSummary } from '@/lib/catalog/types';
import type { SyncOp } from '@/lib/watchlist-sync';
import { syncWatchlist } from '@/lib/watchlist-actions';

export type ListStatus = 'planned' | 'current' | 'completed' | 'dropped';
export const LIST_STATUSES: ListStatus[] = ['planned', 'current', 'completed', 'dropped'];

export interface ListEntry {
  id: number;
  kind: Kind;
  title: string;
  cover: string | null;
  color: string | null;
  status: ListStatus | null;
  favorite: boolean;
  /** İzlenen bölüm / okunan bölüm sayısı */
  progress?: number;
  /** Toplam bölüm/chapter (biliniyorsa); seviye hesabı için */
  total?: number | null;
  /** AniList türleri; profil istatistikleri için */
  genres?: string[];
  updatedAt: number;
}

/**
 * Senkron durumu:
 *  - local   : giriş yok, liste yalnızca bu tarayıcıda
 *  - syncing : hesaba kaydediliyor / hesaptan okunuyor
 *  - synced  : hesapla aynı
 *  - error   : gönderilemedi; değişiklikler bekleyen kuyrukta durur, yeniden denenir
 */
export type SyncState = 'local' | 'syncing' | 'synced' | 'error';

const STORAGE_KEY = 'watchlist:v1';
/** Hesaba henüz gönderilmemiş değişiklikler (sayfa kapansa da kaybolmaz). */
const PENDING_KEY = 'watchlist:pending:v1';
/** Yerel listenin hangi hesaba ait olduğu. Boşsa liste girişsiz oluşturulmuştur ve ilk girişte hesaba taşınır. */
const OWNER_KEY = 'watchlist:owner:v1';
const EMPTY: ListEntry[] = [];
const BATCH = 500; // SYNC_MAX_OPS ile aynı

let cache: ListEntry[] | null = null;
let memoryOnly = false;
const listeners = new Set<() => void>();

const isEntry = (value: unknown): value is ListEntry => {
  const e = value as ListEntry;
  return (
    !!e &&
    typeof e.id === 'number' &&
    ['anime', 'manga', 'manhwa'].includes(e.kind) &&
    typeof e.title === 'string' &&
    (e.status === null || LIST_STATUSES.includes(e.status)) &&
    typeof e.favorite === 'boolean'
  );
};

/* ------------------------------ Yerel depo ------------------------------ */

const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
};

function read(): ListEntry[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(storage.get(STORAGE_KEY) ?? '[]');
    cache = Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: ListEntry[]) {
  cache = next.filter((e) => e.status !== null || e.favorite);
  memoryOnly = !storage.set(STORAGE_KEY, JSON.stringify(cache)); // depolama kapalıysa liste yalnızca bu oturumda kalır
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Tüm liste girdileri (sunucuda boş dizi döner, hidrasyon uyumsuzluğu olmaz). */
export const useWatchlist = () => useSyncExternalStore(subscribe, read, () => EMPTY);

export const isMemoryOnly = () => memoryOnly;

/* ------------------------------ Hesap senkronu ------------------------------ */

type PendingOp = SyncOp & { key: string };

let syncUser: string | null = null;
let syncState: SyncState = 'local';
let inflight = false;
let rerun = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 2000;
const stateListeners = new Set<() => void>();

function setSyncState(next: SyncState) {
  if (next === syncState) return;
  syncState = next;
  stateListeners.forEach((listener) => listener());
}

/** Senkron durumu (giriş yoksa 'local'). */
export const useSyncState = () =>
  useSyncExternalStore(
    (listener) => {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    () => syncState,
    () => 'local' as SyncState,
  );

function readPending(): PendingOp[] {
  try {
    const parsed: unknown = JSON.parse(storage.get(PENDING_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as PendingOp[]) : [];
  } catch {
    return [];
  }
}

const writePending = (ops: PendingOp[]) => storage.set(PENDING_KEY, ops.length ? JSON.stringify(ops) : null);

const opKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function enqueue(ops: SyncOp[]) {
  if (!syncUser || ops.length === 0) return;
  writePending([...readPending(), ...ops.map((op) => ({ ...op, key: opKey() }))]);
  setSyncState('syncing');
  schedule(400);
}

function schedule(delay: number) {
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), delay);
}

/** Sunucu listesine henüz gönderilmemiş yerel değişiklikleri uygular (yanıt beklerken yapılanlar kaybolmasın). */
function overlay(entries: ListEntry[], ops: SyncOp[]): ListEntry[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const op of ops) {
    if (op.op === 'delete') byId.delete(op.id);
    else byId.set(op.entry.id, op.entry as ListEntry);
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

async function flush() {
  const user = syncUser;
  if (!user) return;
  if (inflight) {
    rerun = true;
    return;
  }
  inflight = true;
  setSyncState('syncing');

  // İlk girişte (liste henüz bir hesaba ait değilse) tarayıcıdaki liste hesaba taşınır.
  const merging = storage.get(OWNER_KEY) === null;
  const local: SyncOp[] = merging
    ? read().map((entry) => ({ op: 'put', entry: { ...entry, updatedAt: Number.isFinite(entry.updatedAt) && entry.updatedAt > 0 ? entry.updatedAt : Date.now() } }))
    : [];
  const pending = readPending();
  const room = Math.max(0, BATCH - local.length);
  const sent = pending.slice(0, room);
  const ops = [...local.slice(0, BATCH), ...sent.map(({ key: _key, ...op }) => op as SyncOp)];
  const rest = local.length > BATCH; // çok büyük ilk birleştirme: kalanlar sonraki turda

  try {
    const result = await syncWatchlist(ops);
    if (syncUser !== user) return; // bu arada çıkış yapıldı / hesap değişti
    if (!result.ok) {
      if (result.error === 'unauthorized') return void stopSync(user);
      throw new Error(result.error);
    }
    const sentKeys = new Set(sent.map((op) => op.key));
    const remaining = readPending().filter((op) => !sentKeys.has(op.key));
    if (rest) {
      // İlk birleştirmenin gönderilmeyen kısmını kuyruğa al; sahiplik işaretini sonra koy.
      writePending([...local.slice(BATCH).map((op) => ({ ...op, key: opKey() })), ...remaining]);
    } else {
      writePending(remaining);
    }
    if (!rest) storage.set(OWNER_KEY, user);
    write(overlay(result.entries as ListEntry[], readPending()));
    retryDelay = 2000;
    if (readPending().length > 0) rerun = true;
    else setSyncState('synced');
  } catch {
    if (syncUser !== user) return;
    setSyncState('error');
    schedule(retryDelay);
    retryDelay = Math.min(retryDelay * 2, 60_000);
  } finally {
    inflight = false;
    if (rerun && syncUser === user) {
      rerun = false;
      schedule(0);
    }
  }
}

function stopSync(user: string) {
  if (syncUser !== user) return;
  syncUser = null;
  applied = undefined; // oturum yeniden bildirilince tekrar denensin
  clearTimeout(timer);
  setSyncState('local');
}

/**
 * Oturum durumu değişince çağrılır (WatchlistSync bileşeni).
 *  - giriş var  : liste hesaptan okunur; tarayıcıdaki girişsiz liste ilk seferde hesaba taşınır
 *  - giriş yok  : yerel liste bir hesaba aitse bu cihazdan temizlenir (hesapta durur; ortak bilgisayarda başkası görmesin)
 */
let applied: string | null | undefined; // undefined: oturum durumu henüz hiç bildirilmedi

export function setSyncUser(userId: string | null) {
  if (userId === applied) return;
  applied = userId;
  const owner = storage.get(OWNER_KEY);

  if (!userId) {
    syncUser = null;
    clearTimeout(timer);
    setSyncState('local');
    // Yalnızca hesaba taşınmış liste temizlenir; henüz taşınamamış girişsiz liste yerinde kalır.
    if (owner !== null) {
      storage.set(OWNER_KEY, null);
      writePending([]);
      write([]);
    }
    return;
  }

  // Yerel liste başka bir hesaba aitse ona karışmasın: sil, bu hesabın listesini indir.
  if (owner !== null && owner !== userId) {
    writePending([]);
    write([]);
    storage.set(OWNER_KEY, userId);
  }
  syncUser = userId;
  retryDelay = 2000;
  void flush();
}

/** Hata sonrası elle yeniden deneme. */
export const retrySync = () => {
  if (syncUser) schedule(0);
};

// Bağlantı geri gelince bekleyenler gönderilir. Başka sekmede yapılan değişiklikleri o sekme kendi gönderir;
// bu sekme listeyi `storage` olayıyla yeniler.
if (typeof window !== 'undefined') window.addEventListener('online', retrySync);

/* ------------------------------ Değişiklikler ------------------------------ */

type Identity = Pick<MediaSummary, 'id' | 'kind' | 'title' | 'cover' | 'color'> & { total?: number | null; genres?: string[] };

function upsert(media: Identity, patch: Partial<Pick<ListEntry, 'status' | 'favorite' | 'progress'>>) {
  const current = read();
  const existing = current.find((e) => e.id === media.id);
  const entry: ListEntry = {
    id: media.id,
    kind: media.kind,
    title: media.title,
    cover: media.cover,
    color: media.color,
    status: existing?.status ?? null,
    favorite: existing?.favorite ?? false,
    progress: existing?.progress,
    total: media.total ?? existing?.total ?? null,
    genres: media.genres?.length ? media.genres : existing?.genres,
    ...patch,
    updatedAt: Date.now(),
  };
  write([entry, ...current.filter((e) => e.id !== media.id)]);
  enqueue([entry.status === null && !entry.favorite ? { op: 'delete', id: entry.id, at: entry.updatedAt } : { op: 'put', entry }]);
}

export const setStatus = (media: Identity, status: ListStatus | null) => upsert(media, { status });

export const setProgress = (media: Identity, progress: number) => upsert(media, { progress: Math.max(0, Math.floor(progress)) });

export const toggleFavorite = (media: Identity) =>
  upsert(media, { favorite: !read().find((e) => e.id === media.id)?.favorite });

export const removeEntry = (id: number) => {
  write(read().filter((e) => e.id !== id));
  enqueue([{ op: 'delete', id, at: Date.now() }]);
};

export function importEntries(json: string): number | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    // İçe aktarılan girdiler "şimdi" değişmiş sayılır: hesaptaki eski kopyaları ezer.
    const now = Date.now();
    const incoming = parsed.filter(isEntry).map((e, i) => ({ ...e, updatedAt: now - i }));
    const ids = new Set(incoming.map((e) => e.id));
    write([...incoming, ...read().filter((e) => !ids.has(e.id))]);
    enqueue(incoming.filter((e) => e.status !== null || e.favorite).map((entry) => ({ op: 'put', entry })));
    return incoming.length;
  } catch {
    return null;
  }
}

export const exportEntries = () => JSON.stringify(read(), null, 2);
