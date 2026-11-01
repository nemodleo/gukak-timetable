import { describe, expect, it } from "vitest";
import {
  clientIp,
  dbStore,
  lockMsFor,
  memoryStore,
  POLICY,
  recordFailure,
  recordSuccess,
  retryAfterSec,
  type AttemptDb,
} from "./loginLimiter";

const MIN = 60_000;

describe("lockMsFor", () => {
  it("gives free guesses, then doubles from 5 minutes up to an hour", () => {
    expect(lockMsFor(POLICY.freeFails)).toBe(0);
    expect(lockMsFor(POLICY.freeFails + 1)).toBe(5 * MIN);
    expect(lockMsFor(POLICY.freeFails + 2)).toBe(10 * MIN);
    expect(lockMsFor(POLICY.freeFails + 3)).toBe(20 * MIN);
    expect(lockMsFor(POLICY.freeFails + 4)).toBe(40 * MIN);
    expect(lockMsFor(POLICY.freeFails + 5)).toBe(60 * MIN);
    expect(lockMsFor(POLICY.freeFails + 20)).toBe(60 * MIN);
  });
});

describe("limiter with memory store", () => {
  it("locks after the free guesses, reports the wait, and unlocks on time", async () => {
    const store = memoryStore();
    const t0 = 1_000_000;
    for (let i = 1; i <= POLICY.freeFails; i++) {
      const r = await recordFailure(store, "1.2.3.4", t0 + i);
      expect(r.lockMs).toBe(0);
      expect(r.remaining).toBe(POLICY.freeFails - i);
      expect(await retryAfterSec(store, "1.2.3.4", t0 + i)).toBe(0);
    }
    const locked = await recordFailure(store, "1.2.3.4", t0 + 10);
    expect(locked.lockMs).toBe(5 * MIN);
    expect(await retryAfterSec(store, "1.2.3.4", t0 + 10)).toBe(300);
    expect(await retryAfterSec(store, "1.2.3.4", t0 + 10 + 4 * MIN)).toBe(60);
    expect(await retryAfterSec(store, "1.2.3.4", t0 + 10 + 5 * MIN)).toBe(0);
    // another wrong guess right after the lock expires escalates
    const again = await recordFailure(store, "1.2.3.4", t0 + 10 + 5 * MIN);
    expect(again.lockMs).toBe(10 * MIN);
  });

  it("forgets a quiet IP's history and keeps IPs apart", async () => {
    const store = memoryStore();
    const t0 = 5_000_000;
    for (let i = 0; i < POLICY.freeFails; i++) await recordFailure(store, "a", t0 + i);
    expect(await retryAfterSec(store, "b", t0)).toBe(0);
    const later = await recordFailure(store, "a", t0 + POLICY.forgetAfterMs + 1_000);
    expect(later.fails).toBe(1);
  });

  it("a correct login clears the count", async () => {
    const store = memoryStore();
    for (let i = 0; i < POLICY.freeFails; i++) await recordFailure(store, "a", 1 + i);
    await recordSuccess(store, "a");
    expect((await recordFailure(store, "a", 100)).fails).toBe(1);
  });
});

describe("dbStore", () => {
  function fakeDb(rows: Map<string, Record<string, unknown>>, fail = false): AttemptDb {
    const boom = { message: 'relation "login_attempts" does not exist' };
    return {
      from: () => ({
        select: () => ({
          eq: (_c: string, ip: string) => ({
            maybeSingle: async () => (fail ? { data: null, error: boom } : { data: rows.get(ip) ?? null, error: null }),
          }),
        }),
        upsert: async (row) => {
          if (fail) return { error: boom };
          rows.set(row.ip as string, row);
          return { error: null };
        },
        delete: () => ({
          eq: async (_c: string, ip: string) => {
            if (fail) return { error: boom };
            rows.delete(ip);
            return { error: null };
          },
        }),
      }),
    };
  }

  it("persists attempts as ISO timestamps and reads them back", async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const store = dbStore(fakeDb(rows));
    const now = Date.UTC(2026, 10, 1, 12, 0, 0);
    for (let i = 0; i <= POLICY.freeFails; i++) await recordFailure(store, "9.9.9.9", now);
    expect(rows.get("9.9.9.9")?.locked_until).toBe(new Date(now + 5 * MIN).toISOString());
    expect(await retryAfterSec(store, "9.9.9.9", now + 60_000)).toBe(240);
    await recordSuccess(store, "9.9.9.9");
    expect(rows.has("9.9.9.9")).toBe(false);
  });

  it("falls back to memory when the table is missing, without failing open", async () => {
    const store = dbStore(fakeDb(new Map(), true));
    for (let i = 0; i <= POLICY.freeFails; i++) await recordFailure(store, "x", 1 + i);
    expect(await retryAfterSec(store, "x", 100)).toBeGreaterThan(0);
  });
});

describe("clientIp", () => {
  it("takes the first forwarded hop, then x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
