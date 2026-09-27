/**
 * Browser-side helpers for talking to our own serverless API routes.
 *
 * The Gemini API key is NEVER present in this bundle. All AI calls go
 * through same-origin endpoints (/api/generate-story, /api/generate-image),
 * where the key is injected server-side from GEMINI_API_KEY.
 */

const MAX_ATTEMPTS = 5;

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Error thrown for non-2xx API responses. Carries the HTTP status, the
 *  friendly server message (e.g. the 429 quota message), and the optional
 *  machine-readable `code` (e.g. "SERVER_MISCONFIGURED") so the UI can show it. */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** Server misconfiguration never resolves by retrying — fail fast. */
  get isMisconfigured(): boolean {
    return this.code === "SERVER_MISCONFIGURED";
  }
}

async function readErrorBody(response: Response): Promise<{ error?: unknown; code?: unknown }> {
  try {
    return (await response.json()) as { error?: unknown; code?: unknown };
  } catch {
    // Body isn't JSON (e.g. proxy error page) — caller uses fallbacks.
    return {};
  }
}

async function throwForStatus(path: string, response: Response): Promise<never> {
  const fallback =
    response.status === 429
      ? "You've reached the hourly story limit. Please try again later."
      : `Request to ${path} failed (status ${response.status}). Please try again.`;
  const body = await readErrorBody(response);
  const message = typeof body.error === "string" && body.error.length > 0 ? body.error : fallback;
  const code = typeof body.code === "string" ? body.code : undefined;
  throw new ApiError(response.status, message, code);
}

/** 400/429/misconfigured mean "don't bother retrying" — the next attempt would fail too. */
function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  if (error.status === 400 || error.status === 429 || error.isMisconfigured) return false;
  return true;
}

/**
 * Streams a story from POST /api/generate-story.
 *
 * Reads the plain-text stream to completion and returns the full story.
 * `onChunk` is called incrementally so callers can render live updates.
 * Retries transient failures with exponential backoff (like the old
 * client-side helper did); throws after MAX_ATTEMPTS so the UI can show
 * its friendly "cloudy stars" message.
 */
export const generateStoryWithGeminiStream = async (
  prompt: string,
  onChunk?: (chunk: string) => void,
  retryCount = 0,
): Promise<string | undefined> => {
  try {
    const response = await postJson("/api/generate-story", { prompt });
    if (!response.ok) {
      await throwForStatus("/api/generate-story", response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      // No stream available (older browser): fall back to full text.
      return await response.text();
    }

    const decoder = new TextDecoder();
    let fullText = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      onChunk?.(chunk);
    }
    fullText += decoder.decode();
    return fullText;
  } catch (error) {
    if (isRetryable(error) && retryCount < MAX_ATTEMPTS) {
      const waitTime = Math.pow(2, retryCount) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return generateStoryWithGeminiStream(prompt, onChunk, retryCount + 1);
    }
    throw error;
  }
};

/**
 * Generates a cover image via POST /api/generate-image.
 * Returns a `data:<mime>;base64,...` URL, or undefined when unavailable.
 * Retries transient failures twice; 400/429/misconfigured fail fast.
 * Throws after retries so the UI can show its (non-blocking) failure notice.
 */
export const generateImageWithGemini = async (prompt: string, retryCount = 0): Promise<string | undefined> => {
  try {
    const response = await postJson("/api/generate-image", { prompt });
    if (!response.ok) {
      await throwForStatus("/api/generate-image", response);
    }
    const data = (await response.json()) as { imageDataUrl?: unknown };
    return typeof data.imageDataUrl === "string" ? data.imageDataUrl : undefined;
  } catch (error) {
    if (isRetryable(error) && retryCount < 2) {
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      return generateImageWithGemini(prompt, retryCount + 1);
    }
    throw error;
  }
};
