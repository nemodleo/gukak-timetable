import { describe, expect, it } from "vitest";
import { noticeHidden } from "./notice";

describe("noticeHidden", () => {
  const today = "2026-11-12";
  it("shows by default", () => {
    expect(noticeHidden({ closedThisTab: false, hiddenOn: null, today })).toBe(false);
  });
  it("hides in a tab where it was closed", () => {
    expect(noticeHidden({ closedThisTab: true, hiddenOn: null, today })).toBe(true);
  });
  it("hides for the rest of the day after '오늘 하루 보지 않기'", () => {
    expect(noticeHidden({ closedThisTab: false, hiddenOn: today, today })).toBe(true);
  });
  it("shows again the next day", () => {
    expect(noticeHidden({ closedThisTab: false, hiddenOn: "2026-11-11", today })).toBe(false);
  });
});
