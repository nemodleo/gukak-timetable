import type { DayMemo, MemoLine, SlotDef } from "./types";
import { fromMin, toMin } from "./time";

/** Accept both the new {start,end} slot shape and the legacy {label,hours}. */
export function normalizeSlots(raw: unknown, fallbackStart = 360): SlotDef[] {
  if (!Array.isArray(raw)) return [];
  let cursor = fallbackStart;
  const out: SlotDef[] = [];
  for (const s of raw as Array<Record<string, unknown>>) {
    if (typeof s?.start === "string" && typeof s?.end === "string") {
      out.push({
        start: s.start,
        end: s.end,
        ...(typeof s.label === "string" && s.label ? { label: s.label } : {}),
      });
      cursor = toMin(s.end);
    } else {
      // legacy {label, hours}
      const hours = Number(s?.hours) || 2;
      const start = fromMin(cursor);
      const end = fromMin(cursor + hours * 60);
      out.push({
        start,
        end,
        ...(typeof s?.label === "string" && s.label ? { label: s.label as string } : {}),
      });
      cursor += hours * 60;
    }
  }
  return out;
}

/** Accept new {lines:{"HH:MM":{text,red}}} and legacy {memos:string[]}. */
export function normalizeMemo(date: string, raw: unknown): DayMemo {
  const r = raw as Record<string, unknown> | null | undefined;
  if (r && r.lines && typeof r.lines === "object") {
    return { date, lines: r.lines as Record<string, MemoLine> };
  }
  const legacy: string[] = Array.isArray(r?.memos)
    ? (r!.memos as string[])
    : Array.isArray(raw)
      ? (raw as string[])
      : [];
  const lines: Record<string, MemoLine> = {};
  legacy.forEach((t, i) => {
    lines[fromMin(6 * 60 + i * 30)] = { text: String(t) };
  });
  return { date, lines };
}
