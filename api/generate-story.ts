/**
 * POST /api/generate-story
 *
 * Vercel serverless function (Node runtime). The Gemini API key lives ONLY
 * here, server-side, via the GEMINI_API_KEY environment variable. It is
 * never bundled into, or returned to, the browser.
 *
 * Request body:  { "prompt": string }  (1..2000 chars)
 * Response:      200 with the story streamed back as plain text (UTF-8).
 *                400 on invalid input, 405 on wrong method,
 *                429 when the per-IP hourly quota (10/hour) is exhausted,
 *                5xx with a generic message (never leaks the key or internals).
 */

// Minimal structural types so this file typechecks without extra deps.
import { checkRateLimit, getClientIp, rateLimitMessage, type RateLimitReq } from "./_rate-limit.ts";

type Req = RateLimitReq & {
  method?: string;
  body?: unknown;
};

type Res = {
  headersSent: boolean;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => Res;
  json: (body: unknown) => void;
  write: (chunk: string) => void;
  end: () => void;
};

const MODEL = "gemini-3-flash-preview";
const MAX_PROMPT_LENGTH = 2000;
const MAX_ATTEMPTS = 3;

const SYSTEM_INSTRUCTION =
  "You are a fun children's storyteller for 5-year-old boys. Your stories are " +
  "action-packed and funny but always age-appropriate, starring Noah as the hero. " +
  "End with a happy, exciting finish (only a calm sleepy ending for bedtime style). " +
  "If writing in Burmese, use the name 'နိုအာ' for the main character Noah.";

function getPrompt(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const prompt = (body as { prompt?: unknown }).prompt;
  if (typeof prompt !== "string") return null;
  const trimmed = prompt.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_PROMPT_LENGTH) return null;
  return trimmed;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  const limit = checkRateLimit(getClientIp(req), "generate-story");
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    res.status(429).json({ error: rateLimitMessage("stories", limit.retryAfterSeconds) });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fail fast: a missing server key will never resolve itself, so tell the
    // client plainly (with a machine-readable code) instead of a cryptic error.
    res.status(500).json({
      error: "Story service is not configured — please check the server setup.",
      code: "SERVER_MISCONFIGURED",
    });
    return;
  }

  const prompt = getPrompt(req.body);
  if (prompt === null) {
    res.status(400).json({ error: `Invalid request: "prompt" must be a non-empty string of at most ${MAX_PROMPT_LENGTH} characters.` });
    return;
  }

  // Dynamically import the SDK so a missing/broken install fails gracefully
  // inside the try/catch below instead of at module load.
  let GoogleGenAI: any;
  let ThinkingLevel: any;
  try {
    const sdk = await import("@google/genai");
    GoogleGenAI = sdk.GoogleGenAI;
    ThinkingLevel = sdk.ThinkingLevel;
  } catch {
    res.status(500).json({
      error: "Story service is not configured — please check the server setup.",
      code: "SERVER_MISCONFIGURED",
    });
    return;
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const stream = await ai.models.generateContentStream({
        model: MODEL,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      for await (const chunk of stream as AsyncIterable<{ text?: string }>) {
        if (chunk.text) res.write(chunk.text);
      }
      res.end();
      return;
    } catch (err) {
      lastError = err;
      // Only retry while nothing has been sent to the client yet.
      if (res.headersSent) {
        try { res.end(); } catch { /* ignore */ }
        return;
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }

  // Deliberately generic: never expose the API key or SDK error details.
  console.error("generate-story failed:", lastError instanceof Error ? lastError.message : "unknown error");
  if (!res.headersSent) {
    res.status(500).json({ error: "The stars are a bit cloudy tonight. Please try again." });
  } else {
    try { res.end(); } catch { /* ignore */ }
  }
}
