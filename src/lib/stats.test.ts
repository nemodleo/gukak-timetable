import { describe, expect, it } from "vitest";
import type { Cell, Pairing, Settings } from "./types";
import {
  actualVsTarget,
  dowOrder,
  pairingHours,
  weekdayMatrix,
} from "./stats";

const settings: Settings = {
  school_name: "T",
  year: 2026,
  month: 9,
  week_start: "mon",
  rooms: ["A", "B"],
  time_slots_weekday: [
    { start: "06:00", end: "08:00" }, // slot 0 — 2h
    { start: "08:00", end: "10:00" }, // slot 1 — 2h
  ],
  time_slots_weekend: [{ start: "09:00", end: "12:00" }], // 3h
};

function pairing(over: Partial<Pairing> & { id: string }): Pairing {
  return {
    id: over.id,
    ym: "2026-09",
    student_name: over.student_name ?? over.id,
    grade: over.grade ?? "1",
    teacher_name: over.teacher_name ?? "T",
    target_hours: over.target_hours ?? null,
    label: over.label ?? `${over.id} (T)`,
    sort_order: over.sort_order ?? 0,
    active: over.active ?? true,
  };
}

let n = 0;
function cell(
  date: string,
  slot: number,
  kind: "pairing" | "block",
  pairingId: string | null,
): Cell {
  return {
    id: `c${n++}`,
    date,
    room: "A",
    slot_index: slot,
    kind,
    pairing_id: pairingId,
    text: null,
    color: null,
  };
}

describe("pairingHours", () => {
  it("sums 30-minute-grid hours per pairing, ignoring blocks", () => {
    const cells = [
      cell("2026-09-07", 0, "pairing", "p1"), // 2h
      cell("2026-09-08", 1, "pairing", "p1"), // 2h
      cell("2026-09-09", 0, "block", null), // ignored
      cell("2026-09-09", 0, "pairing", null), // no pairing_id -> ignored
    ];
    const h = pairingHours(cells, settings);
    expect(h.get("p1")).toBe(4);
    expect(h.size).toBe(1);
  });

  it("honours the date-set scope", () => {
    const cells = [
      cell("2026-09-07", 0, "pairing", "p1"),
      cell("2026-10-01", 0, "pairing", "p1"), // outside the month
    ];
    const scoped = pairingHours(
      cells,
      settings,
      new Set(["2026-09-07"]),
    );
    expect(scoped.get("p1")).toBe(2);
  });
});

describe("actualVsTarget", () => {
  const pairings = [
    pairing({ id: "p1", target_hours: 4 }),
    pairing({ id: "p2", target_hours: 4 }),
    pairing({ id: "p3", target_hours: 6 }),
    pairing({ id: "p4", target_hours: null }),
    pairing({ id: "p5", target_hours: 4, active: false }),
  ];
  const cells = [
    cell("2026-09-07", 0, "pairing", "p1"), // p1: 2h
    cell("2026-09-08", 0, "pairing", "p1"), // p1: 4h total -> exact
    cell("2026-09-07", 0, "pairing", "p2"), // p2: 2h -> under
    cell("2026-09-07", 0, "pairing", "p3"), // p3: 2h
    cell("2026-09-08", 0, "pairing", "p3"),
    cell("2026-09-09", 0, "pairing", "p3"),
    cell("2026-09-10", 0, "pairing", "p3"), // p3: 8h -> over target 6
    cell("2026-09-07", 0, "pairing", "p4"), // p4: 2h, no target
  ];
  const rows = actualVsTarget(pairings, cells, settings);
  const by = Object.fromEntries(rows.map((r) => [r.pairing.id, r]));

  it("classifies exact / under / over / none", () => {
    expect(by.p1.status).toBe("exact");
    expect(by.p1.diff).toBe(0);
    expect(by.p2.status).toBe("under");
    expect(by.p2.diff).toBe(-2);
    expect(by.p3.status).toBe("over");
    expect(by.p3.diff).toBe(2);
    expect(by.p4.status).toBe("none");
    expect(by.p4.diff).toBeNull();
    expect(by.p4.target).toBeNull();
  });

  it("keeps the `over` boolean in sync with status", () => {
    expect(by.p3.over).toBe(true);
    expect(by.p1.over).toBe(false);
  });

  it("drops inactive pairings", () => {
    expect(rows.some((r) => r.pairing.id === "p5")).toBe(false);
  });

  it("reports 0 actual for a pairing with no cells", () => {
    const empty = actualVsTarget(
      [pairing({ id: "x", target_hours: 4 })],
      [],
      settings,
    );
    expect(empty[0]).toMatchObject({ actual: 0, status: "under", diff: -4 });
  });
});

describe("dowOrder", () => {
  it("starts the week on Monday or Sunday", () => {
    expect(dowOrder("mon")).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(dowOrder("sun")).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("weekdayMatrix", () => {
  const pairings = [pairing({ id: "p1" }), pairing({ id: "p2", active: false })];
  const cells = [
    cell("2026-09-07", 0, "pairing", "p1"), // Mon, 2h
    cell("2026-09-09", 0, "pairing", "p1"), // Wed, 2h
    cell("2026-09-09", 1, "pairing", "p1"), // Wed, 2h  -> Wed total 4
    cell("2026-09-09", 0, "block", null), // ignored
  ];

  it("buckets pairing hours into the right weekday column (Mon-start)", () => {
    const [row] = weekdayMatrix(pairings, cells, settings, "mon");
    // order = [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    expect(row.byDay).toEqual([2, 0, 4, 0, 0, 0, 0]);
    expect(row.total).toBe(6);
  });

  it("re-orders columns for a Sunday-start week", () => {
    const [row] = weekdayMatrix(pairings, cells, settings, "sun");
    // order = [Sun, Mon, Tue, Wed, ...]
    expect(row.byDay).toEqual([0, 2, 0, 4, 0, 0, 0]);
  });

  it("only counts cells inside the date-set", () => {
    const [row] = weekdayMatrix(
      pairings,
      cells,
      settings,
      "mon",
      new Set(["2026-09-07"]),
    );
    expect(row.byDay).toEqual([2, 0, 0, 0, 0, 0, 0]);
    expect(row.total).toBe(2);
  });

  it("skips inactive pairings", () => {
    const rows = weekdayMatrix(pairings, cells, settings, "mon");
    expect(rows).toHaveLength(1);
    expect(rows[0].pairing.id).toBe("p1");
  });
});
