/**
 * Family login gate shown in front of the story wizard.
 *
 * Email + password via Supabase Auth. Only `@noah.com` addresses are accepted.
 *
 * NOTE ON ENFORCEMENT: the `@noah.com` check below is client-side UX only and
 * can be bypassed in DevTools. Real access control MUST live server-side:
 *   - enable Supabase Row Level Security (RLS) on every table, and
 *   - verify the Supabase JWT (service role) inside /api/* before spending
 *     Gemini quota. The per-IP rate limiter in api/_rate-limit.ts is only a
 *     second layer of defence, not authentication.
 */
import { useState, type FormEvent } from "react";
import { Moon, LogIn, UserPlus, Mail, Lock } from "lucide-react";
import { supabase, isSupabaseConfigured, isFamilyEmail, FAMILY_EMAIL_DOMAIN } from "../lib/supabase.ts";

export default function LoginGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl p-8 shadow-2xl text-center">
        <Moon className="w-10 h-10 text-amber-300 mx-auto mb-4" />
        <h2 className="text-2xl font-serif font-bold text-white mb-2">Family stories only</h2>
        <p className="text-white/50 text-sm">
          Sign-in isn't configured yet. Ask AChan to set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> in the Vercel project Environment Variables.
        </p>
      </div>
    );
  }

  const client = supabase;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    // Client-side family check (UX only — see NOTE above about RLS).
    if (!isFamilyEmail(email)) {
      setError(`Only ${FAMILY_EMAIL_DOMAIN} family emails can enter the storybook.`);
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      const { data, error: authError } =
        mode === "signin"
          ? await client.auth.signInWithPassword({ email: email.trim(), password })
          : await client.auth.signUp({ email: email.trim(), password });
      if (authError) {
        setError(authError.message);
        return;
      }
      if (!data.session) {
        // Email confirmation is on: no session yet until the user clicks the link.
        setNotice("Account created — check your inbox to confirm it, then sign in.");
        setMode("signin");
        return;
      }
      onSignedIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-8">
        <div className="inline-block p-4 rounded-full bg-white/5 mb-4">
          <Moon className="w-10 h-10 text-amber-300 fill-amber-300/20" />
        </div>
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mb-2">Family stories only</h2>
        <p className="text-white/50 text-sm font-medium">
          Sign in with your {FAMILY_EMAIL_DOMAIN} email to enter Noah's Storybook.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 focus-within:border-amber-400 transition-colors">
          <Mail className="w-4 h-4 text-white/40 shrink-0" />
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@noah.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent text-white placeholder:text-white/30 focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 focus-within:border-amber-400 transition-colors">
          <Lock className="w-4 h-4 text-white/40 shrink-0" />
          <input
            type="password"
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent text-white placeholder:text-white/30 focus:outline-none"
          />
        </label>

        {error && (
          <p className="text-sm text-orange-300 bg-orange-400/10 border border-orange-400/20 rounded-2xl px-4 py-3">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-sm text-amber-200 bg-amber-400/10 border border-amber-400/20 rounded-2xl px-4 py-3">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 font-bold py-4 rounded-2xl shadow-xl shadow-amber-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {mode === "signin" ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {busy ? "Opening the storybook…" : mode === "signin" ? "Sign In" : "Create Family Account"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
          setNotice("");
        }}
        className="w-full mt-4 text-sm text-white/40 hover:text-white/70 font-medium transition-colors"
      >
        {mode === "signin" ? "New here? Create a family account" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
