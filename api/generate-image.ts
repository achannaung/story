/**
 * POST /api/generate-image
 *
 * Vercel serverless function (Node runtime). The Gemini API key lives ONLY
 * here, server-side, via the GEMINI_API_KEY environment variable. It is
 * never bundled into, or returned to, the browser.
 *
 * Request body:  { "prompt": string }  (1..2000 chars)
 * Response:      200 { "imageDataUrl": "data:<mime>;base64,..." }
 *                400 on invalid input, 405 on wrong method,
 *                429 when the per-IP hourly quota (10/hour) is exhausted,
 *                5xx with a generic message (never leaks the key or internals).
 */

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
};

const IMAGE_MODEL = "gemini-2.5-flash-image";
const MAX_PROMPT_LENGTH = 2000;

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

  const limit = checkRateLimit(getClientIp(req), "generate-image");
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    res.status(429).json({ error: rateLimitMessage("images", limit.retryAfterSeconds) });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fail fast: see generate-story.ts — plain message + machine-readable code.
    res.status(500).json({
      error: "Image service is not configured — please check the server setup.",
      code: "SERVER_MISCONFIGURED",
    });
    return;
  }

  const prompt = getPrompt(req.body);
  if (prompt === null) {
    res.status(400).json({ error: `Invalid request: "prompt" must be a non-empty string of at most ${MAX_PROMPT_LENGTH} characters.` });
    return;
  }

  try {
    const sdk = await import("@google/genai");
    const ai = new sdk.GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {
        // Ask for image output only;avoids mixing text into the result.
        responseModalities: ["IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (p: { inlineData?: { mimeType?: string; data?: string } }) =>
        typeof p.inlineData?.data === "string" && p.inlineData.data.length > 0,
    );

    if (!imagePart?.inlineData?.data) {
      res.status(500).json({ error: "Could not create an image for that prompt. Please try again." });
      return;
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    res.status(200).json({ imageDataUrl: `data:${mimeType};base64,${imagePart.inlineData.data}` });
  } catch (err) {
    // Deliberately generic: never expose the API key or SDK error details.
    console.error("generate-image failed:", err instanceof Error ? err.message : "unknown error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Could not create an image right now. Please try again." });
    }
  }
}
