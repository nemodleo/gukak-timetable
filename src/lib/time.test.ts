import { describe, expect, it } from "vitest";
import {
  ceilToStep,
  floorToStep,
  fmt12,
  fromMin,
  durationH,
  stepMarks,
  toMin,
} from "./time";

describe("toMin / fromMin", () => {
  it("parses HH:MM to minutes", () => {
    expect(toMin("06:00")).toBe(360);
    expect(toMin("14:30")).toBe(870);
    expect(toMin("00:00")).toBe(0);
  });

  it("round-trips through fromMin", () => {
    for (const t of ["06:00", "08:30", "23:00", "12:45"]) {
      expect(fromMin(toMin(t))).toBe(t);
    }
  });

  it("fromMin clamps to [0, 30:00] and never wraps", () => {
    expect(fromMin(-10)).toBe("00:00");
    expect(fromMin(25 * 60)).toBe("25:00");
    expect(fromMin(999 * 60)).toBe("30:00");
  });
});

describe("durationH", () => {
  it("returns hours between two marks", () => {
    expect(durationH("06:00", "08:00")).toBe(2);
    expect(durationH("15:30", "17:30")).toBe(2);
    expect(durationH("19:50", "21:50")).toBe(2);
    expect(durationH("08:00", "09:30")).toBe(1.5);
  });

  it("never goes negative", () => {
    expect(durationH("10:00", "09:00")).toBe(0);
  });
});

describe("fmt12", () => {
  it("formats 24h marks as 12h labels", () => {
    expect(fmt12("06:00")).toBe("6:00AM");
    expect(fmt12("12:00")).toBe("12:00PM");
    expect(fmt12("00:00")).toBe("12:00AM");
    expect(fmt12("15:30")).toBe("3:30PM");
  });

  it("wraps past-midnight marks for display", () => {
    expect(fmt12("25:00")).toBe("1:00AM");
  });
});

describe("step helpers", () => {
  it("floor / ceil to 30-minute steps", () => {
    expect(floorToStep(70)).toBe(60);
    expect(ceilToStep(70)).toBe(90);
    expect(floorToStep(60)).toBe(60);
  });

  it("stepMarks lists every 30 min, end-exclusive", () => {
    expect(stepMarks(toMin("06:00"), toMin("07:30"))).toEqual([
      "06:00",
      "06:30",
      "07:00",
    ]);
  });
});
