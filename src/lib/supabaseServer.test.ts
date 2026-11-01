import { describe, expect, it } from "vitest";
import { timeoutFetch } from "./supabaseServer";

/** a fetch that never answers unless its signal aborts */
const hanging: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
  });

describe("timeoutFetch", () => {
  it("aborts a hanging request after the deadline", async () => {
    const f = timeoutFetch(30, hanging);
    const started = Date.now();
    await expect(f("https://db.test/rest/v1/x")).rejects.toMatchObject({ name: "TimeoutError" });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("still honours the caller's own abort signal", async () => {
    const f = timeoutFetch(10_000, hanging);
    const ctrl = new AbortController();
    const p = f("https://db.test/rest/v1/x", { signal: ctrl.signal });
    ctrl.abort(new Error("caller cancelled"));
    await expect(p).rejects.toThrow("caller cancelled");
  });

  it("passes a normal response straight through", async () => {
    const ok: typeof fetch = async () => new Response("hi");
    const res = await timeoutFetch(1000, ok)("https://db.test/");
    expect(await res.text()).toBe("hi");
  });
});
