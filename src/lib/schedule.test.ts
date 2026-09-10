import { describe, expect, it } from "vitest";
import type { DayConfig, Settings } from "./types";
import {
  addDays,
  isInMonth,
  isWeekend,
  iso,
  parseIso,
  roomsForDate,
  slotHours,
  slotsForDate,
  startOfWeek,
  startOfWeekKey,
  weekFromKey,
  weeksOfMonth,
  ymKey,
  ymOf,
  ymsInRange,
} from "./schedule";

const settings: Settings = {
  school_name: "T",
  year: 2026,
  month: 7,
  week_start: "mon",
  rooms: ["A", "B"],
  time_slots_weekday: [
    { start: "06:00", end: "08:00" },
    { start: "08:00", end: "10:00" },
    { start: "10:00", end: "11:00" },
  ],
  time_slots_weekend: [{ start: "09:00", end: "11:00" }],
};

describe("iso / parseIso / addDays", () => {
  it("round-trips a date through iso and parseIso", () => {
    const d = parseIso("2026-09-01");
    expect(iso(d)).toBe("2026-09-01");
  });

  it("addDays crosses month and year boundaries", () => {
    expect(iso(addDays(parseIso("2026-09-30"), 1))).toBe("2026-10-01");
    expect(iso(addDays(parseIso("2026-12-31"), 1))).toBe("2027-01-01");
    expect(iso(addDays(parseIso("2026-03-01"), -1))).toBe("2026-02-28");
  });
});

describe("isInMonth / isWeekend", () => {
  it("isInMonth is 1-based on month", () => {
    expect(isInMonth(parseIso("2026-09-15"), 2026, 9)).toBe(true);
    expect(isInMonth(parseIso("2026-08-31"), 2026, 9)).toBe(false);
    expect(isInMonth(parseIso("2026-09-01"), 2026, 8)).toBe(false);
  });

  it("isWeekend flags Sat and Sun", () => {
    expect(isWeekend(parseIso("2026-09-05"))).toBe(true); // Sat
    expect(isWeekend(parseIso("2026-09-06"))).toBe(true); // Sun
    expect(isWeekend(parseIso("2026-09-07"))).toBe(false); // Mon
  });
});

describe("ym helpers", () => {
  it("ymOf slices the month key", () => {
    expect(ymOf("2026-09-30")).toBe("2026-09");
  });

  it("ymKey zero-pads the month", () => {
    expect(ymKey(2026, 7)).toBe("2026-07");
    expect(ymKey(2026, 12)).toBe("2026-12");
  });

  it("ymsInRange lists every month the range touches, inclusive", () => {
    expect(ymsInRange("2026-09-28", "2026-10-04")).toEqual(["2026-09", "2026-10"]);
    expect(ymsInRange("2026-07-06", "2026-07-12")).toEqual(["2026-07"]);
    expect(ymsInRange("2026-12-30", "2027-01-02")).toEqual(["2026-12", "2027-01"]);
  });
});

describe("week math", () => {
  it("startOfWeek respects the week_start setting", () => {
    // 2026-09-09 is a Wednesday
    expect(startOfWeekKey(parseIso("2026-09-09"), "mon")).toBe("2026-09-07");
    expect(startOfWeekKey(parseIso("2026-09-09"), "sun")).toBe("2026-09-06");
  });

  it("startOfWeek is idempotent on a week-start day", () => {
    const mon = parseIso("2026-09-07");
    expect(iso(startOfWeek(mon, "mon"))).toBe("2026-09-07");
  });

  it("weeksOfMonth covers every day of the month, spilling at the edges", () => {
    const weeks = weeksOfMonth(2026, 9, "mon");
    expect(weeks[0].key).toBe("2026-08-31"); // Mon before Sep 1 (Tue)
    expect(weeks.at(-1)!.end.getMonth()).toBe(9); // spills into October
    const covered = new Set(weeks.flatMap((w) => w.days.map(iso)));
    for (let day = 1; day <= 30; day++) {
      expect(covered.has(`2026-09-${String(day).padStart(2, "0")}`)).toBe(true);
    }
    expect(weeks.every((w) => w.days.length === 7)).toBe(true);
  });

  it("weekFromKey round-trips the start key and yields 7 days", () => {
    const w = weekFromKey("2026-09-07");
    expect(w.key).toBe("2026-09-07");
    expect(w.days.map(iso)).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
  });
});

describe("slots for a date", () => {
  const weekday = parseIso("2026-09-07"); // Mon
  const weekend = parseIso("2026-09-05"); // Sat

  it("falls back to weekday / weekend settings", () => {
    expect(slotsForDate(weekday, settings)).toHaveLength(3);
    expect(slotsForDate(weekend, settings)).toHaveLength(1);
  });

  it("a day config overrides the slot list", () => {
    const cfg: DayConfig = {
      date: "2026-09-07",
      rooms: null,
      slots: [
        { start: "14:00", end: "15:30" },
        { start: "15:30", end: "17:30" },
      ],
    };
    expect(slotsForDate(weekday, settings, cfg)).toHaveLength(2);
    expect(slotHours(weekday, 0, settings, cfg)).toBe(1.5);
    expect(slotHours(weekday, 1, settings, cfg)).toBe(2);
  });

  it("slotHours reads the real band, 0 for a missing index", () => {
    expect(slotHours(weekday, 0, settings)).toBe(2);
    expect(slotHours(weekday, 2, settings)).toBe(1);
    expect(slotHours(weekday, 9, settings)).toBe(0);
  });

  it("roomsForDate uses the config rooms when present", () => {
    expect(roomsForDate(weekday, settings)).toEqual(["A", "B"]);
    expect(
      roomsForDate(weekday, settings, {
        date: "2026-09-07",
        rooms: ["X"],
        slots: null,
      }),
    ).toEqual(["X"]);
  });
});
