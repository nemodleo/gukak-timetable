import type { Cell, DayConfig, Pairing, Settings, WeekStart } from "./types";
import {
  parseIso,
  slotHours,
  slotsForDate,
  roomsForDate,
  iso,
  type DayConfigMap,
  type Week,
} from "./schedule";
import { durationH } from "./time";

export function pairingMap(pairings: Pairing[]): Map<string, Pairing> {
  return new Map(pairings.map((p) => [p.id, p]));
}

export function cellHours(c: Cell, s: Settings, cfg?: DayConfigMap): number {
  return slotHours(parseIso(c.date), c.slot_index, s, cfg?.get(c.date));
}

/* ---- per-pairing hours (optionally scoped to a date set) ---- */
export function pairingHours(
  cells: Cell[],
  s: Settings,
  dateSet?: Set<string>,
  cfg?: DayConfigMap,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of cells) {
    if (c.kind !== "pairing" || !c.pairing_id) continue;
    if (dateSet && !dateSet.has(c.date)) continue;
    out.set(c.pairing_id, (out.get(c.pairing_id) ?? 0) + cellHours(c, s, cfg));
  }
  return out;
}

export type TargetStatus = "over" | "under" | "exact" | "none";

export interface ActualVsTarget {
  pairing: Pairing;
  actual: number;
  target: number | null;
  over: boolean;
  /** over = 초과, under = 미달, exact = 정확히 일치, none = 목표 미입력 */
  status: TargetStatus;
  diff: number | null;
}

/** mirrors xlsx E24:E568  "<actual> / <target>", red when actual > target */
export function actualVsTarget(
  pairings: Pairing[],
  cells: Cell[],
  s: Settings,
  dateSet?: Set<string>,
  cfg?: DayConfigMap,
): ActualVsTarget[] {
  const hrs = pairingHours(cells, s, dateSet, cfg);
  return pairings
    .filter((p) => p.active)
    .map((p): ActualVsTarget => {
      const actual = hrs.get(p.id) ?? 0;
      const target = p.target_hours;
      const status: TargetStatus =
        target == null
          ? "none"
          : actual > target
            ? "over"
            : actual < target
              ? "under"
              : "exact";
      return {
        pairing: p,
        actual,
        target,
        over: status === "over",
        status,
        diff: target != null ? actual - target : null,
      };
    });
}

/* ---- pairing x weekday matrix (xlsx CY9:DF20) ---- */
export function dowOrder(weekStart: WeekStart): number[] {
  // values of Date.getDay()
  return weekStart === "mon" ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
}
export const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

export interface WeekdayRow {
  pairing: Pairing;
  byDay: number[]; // length 7, ordered per dowOrder
  total: number;
}

export function weekdayMatrix(
  pairings: Pairing[],
  cells: Cell[],
  s: Settings,
  weekStart: WeekStart,
  dateSet?: Set<string>,
  cfg?: DayConfigMap,
): WeekdayRow[] {
  const order = dowOrder(weekStart);
  const idxOf = new Map(order.map((g, i) => [g, i]));
  const rows = new Map<string, number[]>();
  for (const p of pairings) if (p.active) rows.set(p.id, [0, 0, 0, 0, 0, 0, 0]);
  for (const c of cells) {
    if (c.kind !== "pairing" || !c.pairing_id) continue;
    if (dateSet && !dateSet.has(c.date)) continue;
    const arr = rows.get(c.pairing_id);
    if (!arr) continue;
    const col = idxOf.get(parseIso(c.date).getDay());
    if (col == null) continue;
    arr[col] += cellHours(c, s, cfg);
  }
  return pairings
    .filter((p) => p.active)
    .map((p) => {
      const byDay = rows.get(p.id) ?? [0, 0, 0, 0, 0, 0, 0];
      return { pairing: p, byDay, total: byDay.reduce((a, b) => a + b, 0) };
    });
}

/* ---- fill rate / completion (xlsx CY4:DE4, generalised to whole grid) ---- */
export function dayCompletion(
  date: string,
  cells: Cell[],
  s: Settings,
  cfg?: DayConfigMap,
): { filled: number; total: number; pct: number } {
  const d = parseIso(date);
  const dc = cfg?.get(date);
  const total = slotsForDate(d, s, dc).length * roomsForDate(d, s, dc).length;
  const filled = cells.filter(
    (c) => c.date === date && c.kind !== "block",
  ).length;
  return { filled, total, pct: total ? filled / total : 0 };
}

export function weekCompletion(
  week: Week,
  cells: Cell[],
  s: Settings,
  cfg?: DayConfigMap,
) {
  let filled = 0;
  let total = 0;
  for (const d of week.days) {
    const r = dayCompletion(iso(d), cells, s, cfg);
    filled += r.filled;
    total += r.total;
  }
  return { filled, total, pct: total ? filled / total : 0 };
}

/* ---- teacher rollup ---- */
export function teacherHours(
  pairings: Pairing[],
  cells: Cell[],
  s: Settings,
  dateSet?: Set<string>,
  cfg?: DayConfigMap,
): { teacher: string; hours: number; students: number }[] {
  const pm = pairingMap(pairings);
  const hrs = new Map<string, number>();
  const studs = new Map<string, Set<string>>();
  for (const c of cells) {
    if (c.kind !== "pairing" || !c.pairing_id) continue;
    if (dateSet && !dateSet.has(c.date)) continue;
    const p = pm.get(c.pairing_id);
    if (!p) continue;
    const t = p.teacher_name || "—";
    hrs.set(t, (hrs.get(t) ?? 0) + cellHours(c, s, cfg));
    if (!studs.has(t)) studs.set(t, new Set());
    studs.get(t)!.add(p.student_name);
  }
  return [...hrs.entries()]
    .map(([teacher, hours]) => ({
      teacher,
      hours,
      students: studs.get(teacher)?.size ?? 0,
    }))
    .sort((a, b) => b.hours - a.hours);
}

/* ---- room utilisation ---- */
export function roomHours(
  cells: Cell[],
  s: Settings,
  dates: string[],
  cfg?: DayConfigMap,
): { room: string; hours: number; capacity: number; util: number }[] {
  const rooms = new Set<string>(s.rooms);
  const cap = new Map<string, number>();
  for (const dstr of dates) {
    const d = parseIso(dstr);
    const dc = cfg?.get(dstr);
    const dayRooms = roomsForDate(d, s, dc);
    for (const r of dayRooms) rooms.add(r);
    const perDay = slotsForDate(d, s, dc).reduce(
      (a, sl) => a + durationH(sl.start, sl.end),
      0,
    );
    for (const room of dayRooms) cap.set(room, (cap.get(room) ?? 0) + perDay);
  }
  const used = new Map<string, number>();
  const dateSet = new Set(dates);
  for (const c of cells) {
    if (!dateSet.has(c.date) || c.kind === "block") continue;
    used.set(c.room, (used.get(c.room) ?? 0) + cellHours(c, s, cfg));
  }
  return [...rooms].map((room) => {
    const hours = used.get(room) ?? 0;
    const capacity = cap.get(room) ?? 0;
    return { room, hours, capacity, util: capacity ? hours / capacity : 0 };
  });
}

/* ---- conflicts: same pairing OR same teacher in >1 room at one date+slot ---- */
export interface Conflict {
  date: string;
  slot_index: number;
  kind: "pairing" | "teacher";
  name: string;
  rooms: string[];
}

export function conflicts(
  dates: string[],
  cells: Cell[],
  pairings: Pairing[],
): Conflict[] {
  const pm = pairingMap(pairings);
  const dateSet = new Set(dates);
  const byPair = new Map<string, string[]>();
  const byTeacher = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const arr = m.get(k);
    if (arr) arr.push(v);
    else m.set(k, [v]);
  };
  for (const c of cells) {
    if (c.kind !== "pairing" || !c.pairing_id || !dateSet.has(c.date)) continue;
    const p = pm.get(c.pairing_id);
    if (!p) continue;
    push(byPair, `${c.date}|${c.slot_index}|${p.id}`, c.room);
    // teachers of 보강/합반 rows are noisy — skip comma rows for teacher clash
    if (!p.grade.includes(",")) {
      push(byTeacher, `${c.date}|${c.slot_index}|${p.teacher_name}`, c.room);
    }
  }
  const out: Conflict[] = [];
  for (const [k, rooms] of byPair) {
    if (rooms.length < 2) continue;
    const [date, slot, pid] = k.split("|");
    out.push({
      date,
      slot_index: Number(slot),
      kind: "pairing",
      name: pm.get(pid)?.label ?? pid,
      rooms,
    });
  }
  for (const [k, rooms] of byTeacher) {
    if (rooms.length < 2) continue;
    const [date, slot, teacher] = k.split("|");
    out.push({
      date,
      slot_index: Number(slot),
      kind: "teacher",
      name: teacher,
      rooms,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.slot_index - b.slot_index);
}

/* ---- headline totals ---- */
export function totals(
  pairings: Pairing[],
  cells: Cell[],
  s: Settings,
  dates: string[],
  cfg?: DayConfigMap,
) {
  const dateSet = new Set(dates);
  let scheduled = 0;
  let external = 0;
  let pairingCells = 0;
  let textCells = 0;
  for (const c of cells) {
    if (!dateSet.has(c.date) || c.kind === "block") continue;
    const h = cellHours(c, s, cfg);
    if (c.kind === "pairing") {
      scheduled += h;
      pairingCells += 1;
    } else {
      external += h;
      textCells += 1;
    }
  }
  const target = pairings
    .filter((p) => p.active && p.target_hours != null)
    .reduce((a, p) => a + (p.target_hours ?? 0), 0);
  return { scheduled, external, target, pairingCells, textCells };
}

export type { DayConfig };
