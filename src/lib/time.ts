/** "HH:MM" (24h) helpers for the 30-minute timetable grid. */

export const STEP_MIN = 30;

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** minutes -> "HH:MM"; does NOT wrap at midnight (25:00 is valid, for
 *  blocks that run past midnight). Clamped to [0, 30:00]. */
export function fromMin(min: number): string {
  const m = Math.max(0, Math.min(Math.round(min), 30 * 60));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "6:00AM" style label. Hours >= 24 wrap for display (25:00 -> 1:00AM). */
export function fmt12(hhmm: string): string {
  const min = toMin(hhmm);
  let h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ap = h < 12 ? "AM" : "PM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")}${ap}`;
}

export function rangeLabel(start: string, end: string): string {
  return `${fmt12(start)}\n~\n${fmt12(end)}`;
}

/** single-line 12h range, for short blocks */
export function rangeLabelShort(start: string, end: string): string {
  return `${fmt12(start)}–${fmt12(end)}`;
}

export function isPastMidnight(hhmm: string): boolean {
  return toMin(hhmm) >= 24 * 60;
}

export function durationH(start: string, end: string): number {
  return Math.max(0, (toMin(end) - toMin(start)) / 60);
}

export function floorToStep(min: number): number {
  return Math.floor(min / STEP_MIN) * STEP_MIN;
}
export function ceilToStep(min: number): number {
  return Math.ceil(min / STEP_MIN) * STEP_MIN;
}

/** list of "HH:MM" marks every 30 min from start..end (end exclusive) */
export function stepMarks(startMin: number, endMin: number): string[] {
  const out: string[] = [];
  for (let m = startMin; m < endMin; m += STEP_MIN) out.push(fromMin(m));
  return out;
}
