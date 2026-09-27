<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7856422b-3940-46e7-ac8f-bcd4cd305bbb

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env.local` and set `GEMINI_API_KEY` to your Gemini API key (never commit this file)
3. Run the app:
   `npm run dev`

> **Local dev note:** the browser calls same-origin `/api/*` routes, which are
> served by Vercel in production. For full local testing run `vercel dev`
> (or `npx vercel dev`) instead of `npm run dev`.

## Environment Variables (required)

| Variable                 | Where to set                                                              | Used by                        |
|--------------------------|---------------------------------------------------------------------------|--------------------------------|
| `GEMINI_API_KEY`         | **Vercel project → Settings → Environment Variables** (Production + Preview). Locally: `.env.local` (git-ignored). | `api/generate-story.ts`, `api/generate-image.ts` (server-side only) |
| `VITE_SUPABASE_URL`      | Same as above (all environments).                                         | Browser login gate (`src/lib/supabase.ts`) |
| `VITE_SUPABASE_ANON_KEY` | Same as above (anon/publishable key only — never the service-role key).   | Browser login gate |

## Security

- The Gemini API key exists **only on the server** (`process.env.GEMINI_API_KEY` inside `api/*`).
  It is never injected into the Vite client bundle (`vite.config.ts` has no `define` for it).
- The browser talks to `POST /api/generate-story` (streams plain text) and
  `POST /api/generate-image` (returns `{ imageDataUrl }`). Both validate that
  `prompt` is a non-empty string of at most 2000 chars (400 otherwise) and
  return generic error messages that never leak the key or internals.
- If `GEMINI_API_KEY` is missing server-side, the APIs fail fast with
  `500 { "code": "SERVER_MISCONFIGURED", ... }` — the client shows the setup
  message directly without retrying.
- **Rate limiting:** each route allows 10 requests per IP per hour (in-memory
  sliding window in `api/_rate-limit.ts`, no extra deps). Over the limit →
  HTTP 429 + `Retry-After` header + friendly JSON message, shown in the UI as
  "The stars need a rest". Note: each serverless instance holds its own
  counter, so this is approximate per-instance protection.
- **Family login gate:** a Supabase email/password screen (`src/components/LoginGate.tsx`)
  sits in front of the wizard and only accepts `@noah.com` addresses. The anon key is
  publishable by design, but real enforcement must be Supabase Row Level Security
  (plus JWT verification in `api/*` before spending quota) — the client-side domain
  check alone can be bypassed in DevTools.
- Verify a build is clean with: `grep -c "AIza" dist/assets/*.js` → must be `0`.
