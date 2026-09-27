/**
 * Supabase client for the family login gate.
 *
 * Only the publishable anon key is exposed to the browser (VITE_SUPABASE_ANON_KEY)
 * — that key is safe to ship *provided* real access control is enforced with
 * Supabase Row Level Security (RLS) policies and, for our /api/* routes,
 * service-side JWT verification. See the NOTE in LoginGate.tsx.
 *
 * Local dev:  copy .env.example -> .env.local and fill in the values.
 * Production: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in the Vercel
 *             project Environment Variables.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** Null when env vars are missing — LoginGate renders a setup notice instead. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

/** Family-only domain. Checked client-side for UX; must ALSO be enforced
 *  server-side (Supabase Auth email allowlist / RLS) — see LoginGate.tsx. */
export const FAMILY_EMAIL_DOMAIN = "@noah.com";

export function isFamilyEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(FAMILY_EMAIL_DOMAIN);
}
