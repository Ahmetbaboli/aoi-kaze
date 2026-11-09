import { NextResponse } from 'next/server';
import { contactSchema } from '@/lib/contact/schema';
import { NotConfiguredError, deliver } from '@/lib/contact/sinks';
import { clientKey, rateLimit } from '@/lib/rate-limit';

const MAX_BODY_BYTES = 10_000;
const LIMIT = 5;
const WINDOW_MS = 10 * 60_000;

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

/** İletişim formu: kaynak doğrulama, hız sınırı, boyut sınırı, honeypot, zod doğrulaması, teslimat. */
export async function POST(request: Request) {
  // Başka bir siteden gelen form gönderimlerini reddet (basit CSRF koruması).
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin) {
    try {
      if (new URL(origin).host !== host) return fail('forbidden', 403);
    } catch {
      return fail('forbidden', 403);
    }
  }

  if (!rateLimit(`contact:${clientKey(request)}`, LIMIT, WINDOW_MS)) return fail('rate_limited', 429);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return fail('too_large', 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail('invalid', 400);
  }

  // Honeypot: gizli alanı yalnızca botlar doldurur. Bota hata göstermeden başarılı gibi yanıt ver.
  if (typeof body === 'object' && body !== null && 'website' in body && (body as { website?: unknown }).website) {
    return NextResponse.json({ ok: true });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return fail('invalid', 400);

  try {
    await deliver({ ...parsed.data, receivedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof NotConfiguredError) {
      console.error('[iletişim]', error.message);
      return fail('unavailable', 503);
    }
    return fail('delivery_failed', 502);
  }

  return NextResponse.json({ ok: true });
}
