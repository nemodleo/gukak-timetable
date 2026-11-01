import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** A healthy query from icn1 takes well under a second. When the project is
 *  paused/unreachable every call used to hang ~7s before failing, so a month
 *  view (settings → 5 parallel reads) blocked for 14s. Cap each request. */
export const DB_TIMEOUT_MS = 3000;

/** fetch that gives up after `ms`, while still honouring the caller's signal */
export function timeoutFetch(ms: number, base: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return base(input, { ...init, signal });
  };
}

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY),
  );
}

/** Service-role client for server routes. Falls back to anon key for read-only
 *  local dev. Returns null when Supabase is not configured at all. */
export function supabaseServer(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: timeoutFetch(DB_TIMEOUT_MS) },
    },
  );
  return cached;
}
