/** Login throttling. Both passwords are shared secrets with no account to
 *  lock, so brute force is throttled per client IP: the first few wrong
 *  guesses are free, then every further one locks that IP for a doubling
 *  interval. Attempts live in Supabase (`login_attempts`) so the limit holds
 *  across serverless instances; if the table is missing or the DB is down
 *  we fall back to this instance's memory rather than failing open. */

export const POLICY = {
  /** wrong guesses allowed before the first lock */
  freeFails: 4,
  /** lock after the (freeFails+1)th failure; doubles each failure after */
  baseLockMs: 5 * 60_000,
  maxLockMs: 60 * 60_000,
  /** a quiet IP's failure count is forgotten after this long */
  forgetAfterMs: 60 * 60_000,
} as const;

export interface AttemptRecord {
  fails: number;
  /** epoch ms; 0 = not locked */
  lockedUntil: number;
  /** epoch ms of the last failure */
  updatedAt: number;
}

export interface AttemptStore {
  get(ip: string): Promise<AttemptRecord | null>;
  set(ip: string, rec: AttemptRecord): Promise<void>;
  clear(ip: string): Promise<void>;
}

/** how long the n-th consecutive failure locks the IP (0 = no lock yet) */
export function lockMsFor(fails: number): number {
  const over = fails - POLICY.freeFails;
  if (over <= 0) return 0;
  return Math.min(POLICY.baseLockMs * 2 ** (over - 1), POLICY.maxLockMs);
}

/** failures still remembered for this IP (stale history is forgotten) */
function liveFails(rec: AttemptRecord | null, now: number): number {
  if (!rec) return 0;
  if (rec.lockedUntil > now) return rec.fails;
  return now - rec.updatedAt > POLICY.forgetAfterMs ? 0 : rec.fails;
}

/** seconds the caller must still wait, 0 when allowed to try */
export async function retryAfterSec(store: AttemptStore, ip: string, now = Date.now()): Promise<number> {
  const rec = await store.get(ip);
  if (!rec || rec.lockedUntil <= now) return 0;
  return Math.ceil((rec.lockedUntil - now) / 1000);
}

export interface FailureResult {
  fails: number;
  /** wrong guesses left before the next lock (0 when locked now) */
  remaining: number;
  lockMs: number;
}

export async function recordFailure(store: AttemptStore, ip: string, now = Date.now()): Promise<FailureResult> {
  const fails = liveFails(await store.get(ip), now) + 1;
  const lockMs = lockMsFor(fails);
  await store.set(ip, { fails, lockedUntil: lockMs ? now + lockMs : 0, updatedAt: now });
  return { fails, remaining: lockMs ? 0 : POLICY.freeFails - fails, lockMs };
}

export async function recordSuccess(store: AttemptStore, ip: string): Promise<void> {
  await store.clear(ip);
}

/* ------------------------------------------------------------------ */
/* stores                                                              */
/* ------------------------------------------------------------------ */

export function memoryStore(): AttemptStore {
  const map = new Map<string, AttemptRecord>();
  return {
    async get(ip) {
      return map.get(ip) ?? null;
    },
    async set(ip, rec) {
      map.set(ip, rec);
    },
    async clear(ip) {
      map.delete(ip);
    },
  };
}

/** minimal shape of a supabase-js client we need (keeps this file testable) */
export interface AttemptDb {
  from(table: string): {
    select(cols: string): {
      eq(col: string, v: string): { maybeSingle(): PromiseLike<{ data: unknown; error: unknown }> };
    };
    upsert(row: Record<string, unknown>): PromiseLike<{ error: unknown }>;
    delete(): { eq(col: string, v: string): PromiseLike<{ error: unknown }> };
  };
}

/** Supabase-backed store; any error on a call falls back to `fallback` for
 *  that call (and is logged once) so a missing table never blocks login. */
export function dbStore(db: AttemptDb, fallback: AttemptStore = memoryStore()): AttemptStore {
  let warned = false;
  const warn = (e: unknown) => {
    if (warned) return;
    warned = true;
    console.warn("[login-limiter] login_attempts unavailable, using in-memory limiter:", e);
  };
  return {
    async get(ip) {
      const { data, error } = await db.from("login_attempts").select("fails,locked_until,updated_at").eq("ip", ip).maybeSingle();
      if (error) {
        warn(error);
        return fallback.get(ip);
      }
      if (!data) return null;
      const r = data as { fails: number; locked_until: string | null; updated_at: string };
      return {
        fails: r.fails,
        lockedUntil: r.locked_until ? Date.parse(r.locked_until) : 0,
        updatedAt: Date.parse(r.updated_at),
      };
    },
    async set(ip, rec) {
      const { error } = await db.from("login_attempts").upsert({
        ip,
        fails: rec.fails,
        locked_until: rec.lockedUntil ? new Date(rec.lockedUntil).toISOString() : null,
        updated_at: new Date(rec.updatedAt).toISOString(),
      });
      if (error) {
        warn(error);
        await fallback.set(ip, rec);
      }
    },
    async clear(ip) {
      const { error } = await db.from("login_attempts").delete().eq("ip", ip);
      if (error) warn(error);
      await fallback.clear(ip);
    },
  };
}

/** client IP as Vercel reports it (first hop of x-forwarded-for) */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || "unknown";
}

export function lockMessage(sec: number): string {
  const min = Math.ceil(sec / 60);
  return `로그인 시도가 너무 많습니다. ${min}분 후 다시 시도하세요.`;
}
