type RateLimitEntry = {
  count: number;
  resetAt: number;
};

function checkRateLimit(
  bucket: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const existing = bucket.get(key);

  if (!existing || now > existing.resetAt) {
    if (bucket.size > 5000) {
      for (const [bucketKey, entry] of bucket) {
        if (now > entry.resetAt) bucket.delete(bucketKey);
      }
    }
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  existing.count += 1;
  return existing.count > limit;
}

const uploadAttempts = new Map<string, RateLimitEntry>();
const eventAttempts = new Map<string, RateLimitEntry>();

export const DEFAULT_PORTAL_STORAGE_QUOTA_BYTES = 500 * 1024 * 1024; // 500MB
export const UPLOAD_RATE_LIMIT_PER_MINUTE = 10;
export const EVENT_RATE_LIMIT_PER_MINUTE = 60;
export const EVENT_METADATA_MAX_BYTES = 4 * 1024;

export function isUploadRateLimited(key: string): boolean {
  return checkRateLimit(uploadAttempts, key, UPLOAD_RATE_LIMIT_PER_MINUTE, 60_000);
}

export function isEventRateLimited(key: string): boolean {
  return checkRateLimit(eventAttempts, key, EVENT_RATE_LIMIT_PER_MINUTE, 60_000);
}
