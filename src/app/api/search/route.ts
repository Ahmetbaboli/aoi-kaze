import { NextResponse } from 'next/server';
import { search } from '@/lib/catalog';
import { clientKey, rateLimit } from '@/lib/rate-limit';

const MIN_LENGTH = 2;
const MAX_LENGTH = 60;
const LIMIT_PER_MINUTE = 40;

/** Arama istemcisi için AniList önünde ince bir vekil: hız sınırı + sorgu doğrulaması + önbellek. */
export async function GET(request: Request) {
  if (!rateLimit(`search:${clientKey(request)}`, LIMIT_PER_MINUTE, 60_000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < MIN_LENGTH || q.length > MAX_LENGTH) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const items = await search(q);
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
