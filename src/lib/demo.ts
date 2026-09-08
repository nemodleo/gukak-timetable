import seed from "@/data/seed-2026.json";
import {
  DEFAULT_SETTINGS,
  type Cell,
  type DayConfig,
  type DayMemo,
  type Pairing,
  type Settings,
  type SeedPayload,
} from "./types";
import { normalizeSlots } from "./normalize";
import { ymOf, ymsInRange } from "./schedule";

/** Read-only fallback dataset used when Supabase is not configured, so the app
 *  is fully browsable as a demo with the real 2026 timetable (per-month roster,
 *  target hours and non-teaching blocks included). */
const s = seed as unknown as SeedPayload;

export const demoSettings: Settings = {
  ...DEFAULT_SETTINGS,
  ...s.settings,
};

export const demoPairings: Pairing[] = s.pairings.map((p, i) => ({
  id: `demo:${p.ym}:${p.label}`,
  ym: p.ym,
  student_name: p.student_name,
  grade: p.grade ?? "",
  teacher_name: p.teacher_name ?? "",
  target_hours: p.target_hours ?? null,
  label: p.label,
  sort_order: p.sort_order ?? i,
  active: true,
}));

const idByYmLabel = new Map(demoPairings.map((p) => [`${p.ym}|${p.label}`, p.id]));

export const demoCells: Cell[] = s.cells
  .map((c, i): Cell | null => {
    const base = { id: `demo-cell:${i}`, date: c.date, room: c.room, slot_index: c.slot_index };
    if (c.kind === "pairing") {
      const pid = c.label ? idByYmLabel.get(`${ymOf(c.date)}|${c.label}`) : undefined;
      if (!pid) return null;
      return { ...base, kind: "pairing", pairing_id: pid, text: null, color: null };
    }
    return {
      ...base,
      kind: "block",
      pairing_id: null,
      text: c.text ?? null,
      color: c.color ?? null,
    };
  })
  .filter((c): c is Cell => c !== null);

export const demoMemos: DayMemo[] = s.memos ?? [];

export const demoDayConfigs: DayConfig[] = (s.day_configs ?? []).map((dc) => ({
  date: dc.date,
  rooms:
    Array.isArray(dc.rooms) && dc.rooms.length ? (dc.rooms as string[]) : null,
  slots:
    Array.isArray(dc.slots) && dc.slots.length
      ? normalizeSlots(dc.slots, 360)
      : null,
}));

export function demoPairingsFor(ym: string): Pairing[] {
  return demoPairings.filter((p) => p.ym === ym);
}
export function demoPairingsForRange(from: string, to: string): Pairing[] {
  const yms = new Set(ymsInRange(from, to));
  return demoPairings.filter((p) => yms.has(p.ym));
}

export function demoCellsBetween(from: string, to: string): Cell[] {
  return demoCells.filter((c) => c.date >= from && c.date <= to);
}
export function demoMemosBetween(from: string, to: string): DayMemo[] {
  return demoMemos.filter((m) => m.date >= from && m.date <= to);
}
export function demoDayConfigsBetween(from: string, to: string): DayConfig[] {
  return demoDayConfigs.filter((c) => c.date >= from && c.date <= to);
}
