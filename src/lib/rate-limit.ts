/**
 * Basit bellek içi sabit pencere hız sınırı. Tek sunucu/örnek için yeterlidir
 * (Vercel'de her örnek ayrı sayar; kesin sınır gerekiyorsa Redis/Upstash kullan).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      buckets.forEach((value, k) => value.resetAt <= now && buckets.delete(k));
    }
    return true;
  }

  bucket.count += 1;
  return bucket.count <= limit;
}

export const clientKey = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
