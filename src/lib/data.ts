import "server-only";
import { supabaseServer } from "./supabaseServer";
import {
  DEFAULT_SETTINGS,
  type Cell,
  type DayConfig,
  type DayMemo,
  type Pairing,
  type Settings,
} from "./types";
import { datesInRange, iso, weeksOfMonth, ymKey, ymsInRange } from "./schedule";
import { normalizeMemo, normalizeSlots } from "./normalize";
import {
  normalizeGradeColors,
  normalizeInactiveBgColor,
  normalizeInactivePattern,
  normalizeInactivePatternColor,
} from "./colors";
import {
  demoCellsBetween,
  demoDayConfigsBetween,
  demoMemosBetween,
  demoPairings,
  demoPairingsFor,
  demoPairingsForRange,
  demoSettings,
} from "./demo";

export async function getSettings(): Promise<Settings> {
  const sb = supabaseServer();
  if (!sb) return demoSettings;
  const { data } = await sb.from("settings").select("*").eq("id", 1).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  return {
    school_name: data.school_name ?? DEFAULT_SETTINGS.school_name,
    year: data.year ?? DEFAULT_SETTINGS.year,
    month: data.month ?? DEFAULT_SETTINGS.month,
    week_start: data.week_start ?? DEFAULT_SETTINGS.week_start,
    rooms:
      Array.isArray(data.rooms) && data.rooms.length
        ? data.rooms
        : DEFAULT_SETTINGS.rooms,
    time_slots_weekday:
      Array.isArray(data.time_slots_weekday) && data.time_slots_weekday.length
        ? normalizeSlots(data.time_slots_weekday, 360)
        : DEFAULT_SETTINGS.time_slots_weekday,
    time_slots_weekend:
      Array.isArray(data.time_slots_weekend) && data.time_slots_weekend.length
        ? normalizeSlots(data.time_slots_weekend, 300)
        : DEFAULT_SETTINGS.time_slots_weekend,
    grade_colors: normalizeGradeColors(data.grade_colors),
    inactive_bg_color: normalizeInactiveBgColor(data.inactive_bg_color),
    inactive_pattern_color: normalizeInactivePatternColor(data.inactive_pattern_color),
    inactive_pattern: normalizeInactivePattern(data.inactive_pattern),
  };
}

/** roster + target hours for a single month ("YYYY-MM") */
export async function getPairings(ym: string): Promise<Pairing[]> {
  const sb = supabaseServer();
  if (!sb) return demoPairingsFor(ym);
  const { data } = await sb
    .from("pairings")
    .select("*")
    .eq("ym", ym)
    .order("sort_order", { ascending: true });
  return (data ?? []) as Pairing[];
}

/** every roster row across all months (backup / export) */
export async function getAllPairings(): Promise<Pairing[]> {
  const sb = supabaseServer();
  if (!sb) return demoPairings;
  const { data } = await sb
    .from("pairings")
    .select("*")
    .order("ym", { ascending: true })
    .order("sort_order", { ascending: true });
  return (data ?? []) as Pairing[];
}

/** roster for every month touched by an inclusive ISO date range (handles weeks
 *  and month views that spill across a month boundary) */
export async function getPairingsForRange(
  from: string,
  to: string,
): Promise<Pairing[]> {
  const yms = ymsInRange(from, to);
  const sb = supabaseServer();
  if (!sb) return demoPairingsForRange(from, to);
  const { data } = await sb
    .from("pairings")
    .select("*")
    .in("ym", yms)
    .order("sort_order", { ascending: true });
  return (data ?? []) as Pairing[];
}

export async function getCells(from: string, to: string): Promise<Cell[]> {
  const sb = supabaseServer();
  if (!sb) return demoCellsBetween(from, to);
  // PostgREST caps a response at 1000 rows; a month of grid cells (blocks
  // included) easily exceeds that, so page through with an explicit order.
  const PAGE = 1000;
  const out: Cell[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from("schedule_cells")
      .select("*")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
      .order("room", { ascending: true })
      .order("slot_index", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error || !data || data.length === 0) break;
    out.push(...(data as Cell[]));
    if (data.length < PAGE) break;
  }
  return out;
}

export async function getMemos(from: string, to: string): Promise<DayMemo[]> {
  const sb = supabaseServer();
  if (!sb) return demoMemosBetween(from, to);
  const { data } = await sb
    .from("day_memos")
    .select("*")
    .gte("date", from)
    .lte("date", to);
  return (data ?? []).map((r) => normalizeMemo(r.date, r));
}

export async function getDayConfigs(
  from: string,
  to: string,
): Promise<DayConfig[]> {
  const sb = supabaseServer();
  if (!sb) return demoDayConfigsBetween(from, to);
  const { data } = await sb
    .from("day_configs")
    .select("*")
    .gte("date", from)
    .lte("date", to);
  return (data ?? []).map((r) => ({
    date: r.date as string,
    rooms: Array.isArray(r.rooms) && r.rooms.length ? (r.rooms as string[]) : null,
    slots:
      Array.isArray(r.slots) && r.slots.length ? normalizeSlots(r.slots, 360) : null,
  })) as DayConfig[];
}

/** dates approved for instructor editing in [from,to]. missing dates default
 *  to locked (admin bypasses this everywhere it's checked). when Supabase
 *  isn't configured (read-only demo), locks don't apply — treat every date
 *  as approved so the demo is never confusingly stuck. */
export async function getDayApprovals(from: string, to: string): Promise<Set<string>> {
  const sb = supabaseServer();
  if (!sb) return new Set(datesInRange(from, to));
  const { data } = await sb
    .from("day_approvals")
    .select("date,approved")
    .gte("date", from)
    .lte("date", to);
  return new Set((data ?? []).filter((r) => r.approved).map((r) => r.date as string));
}

export interface MonthData {
  settings: Settings;
  pairings: Pairing[];
  cells: Cell[];
  memos: DayMemo[];
  dayConfigs: DayConfig[];
  approvedDates: string[];
  from: string;
  to: string;
}

/** everything needed to render a month view (weeks may spill into adjacent months) */
export async function getMonthData(
  year: number,
  month: number,
): Promise<MonthData> {
  const settings = await getSettings();
  const weeks = weeksOfMonth(year, month, settings.week_start);
  const from = iso(weeks[0].start);
  const to = iso(weeks[weeks.length - 1].end);
  const [pairings, cells, memos, dayConfigs, approvals] = await Promise.all([
    // stats / calendar want THIS month's roster only (not spilled weeks')
    getPairings(ymKey(year, month)),
    getCells(from, to),
    getMemos(from, to),
    getDayConfigs(from, to),
    getDayApprovals(from, to),
  ]);
  return {
    settings,
    pairings,
    cells,
    memos,
    dayConfigs,
    approvedDates: [...approvals],
    from,
    to,
  };
}
