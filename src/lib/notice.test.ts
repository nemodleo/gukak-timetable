import { describe, expect, it } from "vitest";
import { noticeHidden } from "./notice";

describe("noticeHidden", () => {
  const today = "2026-11-12";
  const base = { closedOnPath: null, path: "/", hiddenOn: null, today };
  it("shows by default", () => {
    expect(noticeHidden(base)).toBe(false);
  });
  it("hides on the page where it was closed", () => {
    expect(noticeHidden({ ...base, closedOnPath: "/" })).toBe(true);
  });
  it("shows again on another page after closing", () => {
    expect(noticeHidden({ ...base, closedOnPath: "/", path: "/privacy" })).toBe(false);
  });
  it("hides for the rest of the day after '오늘 하루 보지 않기', on every page", () => {
    expect(noticeHidden({ ...base, hiddenOn: today })).toBe(true);
    expect(noticeHidden({ ...base, hiddenOn: today, path: "/docs" })).toBe(true);
  });
  it("shows again the next day", () => {
    expect(noticeHidden({ ...base, hiddenOn: "2026-11-11" })).toBe(false);
  });
});
