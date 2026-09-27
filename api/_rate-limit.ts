/**
 * Shared in-memory rate limiter for the /api/* serverless functions.
 *
 * No new dependencies: a Map of `scope:ip -> request timestamps`, pruned to a
 * sliding 1-hour window. Each caller gets MAX_REQUESTS requests per window.
 *
 * NOTE: serverless instances each hold their own Map, so on Vercel this is
 * approximate (per-instance) protection, not a global counter. That is plenty
 * to stop casual quota-burning; for strict global limits use Vercel Edge
 * Config / Upstash Redis instead.
 */

export type RateLimitReq = {
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};

export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const RATE_LIMIT_MAX_REQUESTS = 10;

const hits = new Map<string, number[]>();

/** Best-effort client IP: respects Vercel's x-forwarded-for header. */
export function getClientIp(req: RateLimitReq): string {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export function checkRateLimit(
  ip: string,
  scope: string,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const key = `${scope}:${ip}`;
  const previous = hits.get(key) ?? [];
  const fresh = previous.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (fresh.length >= RATE_LIMIT_MAX_REQUESTS) {
    hits.set(key, fresh);
    const oldest = fresh[0];
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000)),
    };
  }

  fresh.push(now);
  hits.set(key, fresh);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Friendly, quota-safe message returned with HTTP 429 (no internals). */
export function rateLimitMessage(kind: "stories" | "images", retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  const noun = kind === "stories" ? "stories" : "pictures";
  return (
    `You've woven ${RATE_LIMIT_MAX_REQUESTS} ${noun} this hour — the stars need a little rest. ` +
    `Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`
  );
}
