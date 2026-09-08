import type { DayConfig, Settings, SlotDef } from "./types";
import { ceilToStep, durationH, floorToStep, toMin, STEP_MIN } from "./time";

/* ------------------------------------------------------------------ */
/* date helpers (local, no timezone drift — treat dates as calendar)  */
/* ------------------------------------------------------------------ */

export function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const WD_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function weekdayKo(d: Date): string {
  return WD_KO[d.getDay()];
}

/** "7월 1일 (수)" */
export function fmtDayHeader(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdayKo(d)})`;
}

/** "7. 1" compact */
export function fmtDayShort(d: Date): string {
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export function isWeekend(d: Date): boolean {
  const g = d.getDay();
  return g === 0 || g === 6;
}

export function isInMonth(d: Date, year: number, month: number): boolean {
  return d.getFullYear() === year && d.getMonth() + 1 === month;
}

export function monthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

/** "YYYY-MM" roster/target key for an ISO date */
export function ymOf(dateIso: string): string {
  return dateIso.slice(0, 7);
}

/** "YYYY-MM" roster/target key from a year + 1-based month */
export function ymKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** distinct "YYYY-MM" keys spanned by an inclusive ISO date range */
export function ymsInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const s = parseIso(from);
  const e = parseIso(to);
  const cur = new Date(s.getFullYear(), s.getMonth(), 1);
  const end = new Date(e.getFullYear(), e.getMonth(), 1);
  while (cur <= end) {
    out.push(ymKey(cur.getFullYear(), cur.getMonth() + 1));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* week generation — mirrors the xlsx CR4:CV56 logic:                 */
/* every (Mon|Sun)-started week that overlaps the target month.       */
/* ------------------------------------------------------------------ */

export interface Week {
  index: number; // 1-based
  start: Date;
  end: Date; // start + 6
  days: Date[]; // 7 days
  key: string; // iso(start)
}

export function startOfWeek(d: Date, weekStart: "mon" | "sun"): Date {
  const g = d.getDay(); // 0 Sun .. 6 Sat
  const back = weekStart === "mon" ? (g + 6) % 7 : g;
  return addDays(d, -back);
}

export function startOfWeekKey(d: Date, weekStart: "mon" | "sun"): string {
  return iso(startOfWeek(d, weekStart));
}

export function weeksOfMonth(
  year: number,
  month: number,
  weekStart: "mon" | "sun",
): Week[] {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  let cur = startOfWeek(first, weekStart);
  const weeks: Week[] = [];
  let i = 1;
  while (cur <= last) {
    const days = Array.from({ length: 7 }, (_, k) => addDays(cur, k));
    weeks.push({
      index: i,
      start: cur,
      end: addDays(cur, 6),
      days,
      key: iso(cur),
    });
    cur = addDays(cur, 7);
    i += 1;
  }
  return weeks;
}

export function weekRangeLabel(w: Week): string {
  return `${fmtDayShort(w.start)} – ${fmtDayShort(w.end)}`;
}

/** build a single Week straight from a start-date key (iso yyyy-mm-dd) */
export function weekFromKey(key: string): Week {
  const start = parseIso(key);
  const days = Array.from({ length: 7 }, (_, k) => addDays(start, k));
  return { index: 1, start, end: addDays(start, 6), days, key };
}

export function findWeek(weeks: Week[], dateOrKey: string): Week | undefined {
  return (
    weeks.find((w) => w.key === dateOrKey) ??
    weeks.find((w) => w.days.some((d) => iso(d) === dateOrKey))
  );
}

/* ------------------------------------------------------------------ */
/* slots                                                              */
/* ------------------------------------------------------------------ */

export function slotsForDate(
  d: Date,
  s: Settings,
  cfg?: DayConfig | null,
): SlotDef[] {
  if (cfg?.slots && cfg.slots.length) return cfg.slots;
  return isWeekend(d) ? s.time_slots_weekend : s.time_slots_weekday;
}

export function roomsForDate(
  d: Date,
  s: Settings,
  cfg?: DayConfig | null,
): string[] {
  void d;
  if (cfg?.rooms && cfg.rooms.length) return cfg.rooms;
  return s.rooms;
}

export function slotHours(
  d: Date,
  slotIndex: number,
  s: Settings,
  cfg?: DayConfig | null,
): number {
  const slot = slotsForDate(d, s, cfg)[slotIndex];
  return slot ? durationH(slot.start, slot.end) : 0;
}

export type DayConfigMap = Map<string, DayConfig>;

export function indexDayConfigs(list: DayConfig[]): DayConfigMap {
  return new Map(list.map((c) => [c.date, c]));
}

/* ------------------------------------------------------------------ */
/* 30-minute proportional grid geometry                               */
/* ------------------------------------------------------------------ */

export interface GridGeom {
  startMin: number; // grid top
  endMin: number; // grid bottom (exclusive)
  rows: number; // number of 30-min rows
  rowOf: (hhmm: string) => number; // 0-based row index for a mark
  spanRows: (slot: SlotDef) => { row: number; span: number };
  marks: string[]; // "HH:MM" per row
}

export function gridGeom(
  slots: SlotDef[],
  fallbackStart = "06:00",
  fallbackEnd = "22:00",
): GridGeom {
  // when there are blocks, the grid hugs them exactly (no leading/trailing
  // empty rows); fallbacks only apply to an empty day.
  const starts = slots.map((s) => toMin(s.start));
  const ends = slots.map((s) => toMin(s.end));
  const startMin = floorToStep(
    starts.length ? Math.min(...starts) : toMin(fallbackStart),
  );
  const endMin = ceilToStep(
    ends.length ? Math.max(...ends) : toMin(fallbackEnd),
  );
  const rows = Math.max(1, Math.round((endMin - startMin) / STEP_MIN));
  const rowOf = (hhmm: string) =>
    Math.round((toMin(hhmm) - startMin) / STEP_MIN);
  const marks: string[] = [];
  for (let i = 0; i < rows; i++) {
    const m = startMin + i * STEP_MIN;
    marks.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return {
    startMin,
    endMin,
    rows,
    rowOf,
    marks,
    spanRows: (slot) => {
      const row = rowOf(slot.start);
      const span = Math.max(1, rowOf(slot.end) - row);
      return { row, span };
    },
  };
}

/** sort by start, and return whether any two slots overlap */
export function sortSlots(slots: SlotDef[]): SlotDef[] {
  return [...slots].sort((a, b) => toMin(a.start) - toMin(b.start));
}

export function hasOverlap(slots: SlotDef[]): boolean {
  const s = sortSlots(slots);
  for (let i = 1; i < s.length; i++) {
    if (toMin(s[i].start) < toMin(s[i - 1].end)) return true;
  }
  return false;
}
