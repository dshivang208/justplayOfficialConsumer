/**
 * Single shared Supabase client for the browser.
 *
 * Session persistence (across page refresh) and auto token-refresh are
 * handled entirely by the SDK itself once `persistSession`/`autoRefreshToken`
 * are on — that satisfies the "session persists via local storage" part of
 * Backend Phase B without any custom code.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in the console rather than have every auth call silently
  // reject with a cryptic network error.

  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to " +
      ".env.local and fill in your Supabase project's URL + anon key.",
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "justplay.supabase.auth",
  },
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);