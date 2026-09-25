/** Pure edits to one day's grid structure (rooms × time blocks).
 *
 *  Each op takes the day's current struct and returns the next struct plus,
 *  when cells must follow, a `remap` that re-keys that day's cells. Cells
 *  reference rooms by NAME (reordering rooms needs no remap) but time blocks
 *  by POSITION (slot_index) — so any op that inserts, deletes or re-sorts
 *  blocks has to renumber cells. The grid places blocks by clock time
 *  (gridGeom), never by array order. */
import type { Cell, SlotDef } from "./types";
import { keyOf } from "./cellIndex";
import { sortSlots } from "./schedule";
import { fromMin, toMin } from "./time";

export type Struct = { rooms: string[]; slots: SlotDef[] };
export type CellMap = Map<string, Cell>;
/** null = nothing to do; { error } = refuse with a message */
export type StructChange =
  | { struct: Struct; remap?: (cells: CellMap) => void }
  | { error: string }
  | null;

/** 하루 타임라인 끝 — 자정을 넘겨 몇 시간까지 허용 */
export const DAY_MAX = toMin("29:00");

const OVERLAP = "다른 시간대와 겹쳐서 이동할 수 없습니다";

/** Re-key every cell of `date` through `fn` (return null to drop it).
 *  All moved cells are lifted out before any is written back, so a cell
 *  landing on another moved cell's old key can't clobber it. */
export function remapDay(cells: CellMap, date: string, fn: (c: Cell) => Cell | null) {
  const moved: Cell[] = [];
  for (const [k, c] of [...cells]) {
    if (c.date !== date) continue;
    const next = fn(c);
    if (next === c) continue;
    cells.delete(k);
    if (next) moved.push(next);
  }
  for (const c of moved) cells.set(keyOf(c.date, c.room, c.slot_index), c);
}

const overlaps = (a: SlotDef, b: SlotDef) =>
  toMin(a.start) < toMin(b.end) && toMin(a.end) > toMin(b.start);

/* ---------------- time blocks ---------------- */

/** new 2h block right after the last one (grid grows down) */
export function appendBlock(s: Struct): StructChange {
  const last = s.slots[s.slots.length - 1];
  const start = Math.min(last ? toMin(last.end) : toMin("09:00"), DAY_MAX - 120);
  return {
    struct: { rooms: s.rooms, slots: [...s.slots, { start: fromMin(start), end: fromMin(start + 120) }] },
  };
}

/** fill an empty band with a block; later blocks' cells shift up one index */
export function insertBlock(s: Struct, date: string, start: string, end: string): StructChange {
  const idx = s.slots.filter((x) => toMin(x.start) < toMin(start)).length;
  return {
    struct: {
      rooms: s.rooms,
      slots: [...s.slots.slice(0, idx), { start, end }, ...s.slots.slice(idx)],
    },
    remap: (m) =>
      remapDay(m, date, (c) => (c.slot_index >= idx ? { ...c, slot_index: c.slot_index + 1 } : c)),
  };
}

/** change one block's start/end, clamped between its neighbours */
export function retimeBlock(s: Struct, i: number, patch: Partial<SlotDef>): StructChange {
  const slots = s.slots.map((x, j) => (j === i ? { ...x, ...patch } : x));
  const cur = slots[i];
  let st = toMin(cur.start);
  let en = toMin(cur.end);
  const prev = slots[i - 1];
  const nxt = slots[i + 1];
  if (prev && st < toMin(prev.end)) st = toMin(prev.end);
  if (nxt && en > toMin(nxt.start)) en = toMin(nxt.start);
  if (en <= st) en = Math.min(st + 30, DAY_MAX);
  slots[i] = { ...cur, start: fromMin(st), end: fromMin(en) };
  return { struct: { rooms: s.rooms, slots } };
}

/** drop block i and its cells; later blocks' cells shift down one index */
export function deleteBlock(s: Struct, date: string, i: number): StructChange {
  return {
    struct: { rooms: s.rooms, slots: s.slots.filter((_, j) => j !== i) },
    remap: (m) =>
      remapDay(m, date, (c) =>
        c.slot_index === i ? null : c.slot_index > i ? { ...c, slot_index: c.slot_index - 1 } : c,
      ),
  };
}

/** give some blocks new times, re-sort by start, renumber their cells */
function withSlotTimes(s: Struct, date: string, updated: SlotDef[]): StructChange {
  const sorted = sortSlots(updated);
  // old index -> new index, matched by object identity (survives the sort)
  const newIndexOf = new Map(sorted.map((sl, i) => [sl, i]));
  const perm = updated.map((sl) => newIndexOf.get(sl)!);
  return {
    struct: { rooms: s.rooms, slots: sorted },
    remap: (m) =>
      remapDay(m, date, (c) =>
        c.slot_index < perm.length && perm[c.slot_index] !== c.slot_index
          ? { ...c, slot_index: perm[c.slot_index] }
          : c,
      ),
  };
}

/** drag a block onto an empty band — same duration, new start */
export function moveBlock(s: Struct, date: string, from: number, newStart: string): StructChange {
  const slot = s.slots[from];
  if (!slot) return null;
  const duration = toMin(slot.end) - toMin(slot.start);
  let start = toMin(newStart);
  let end = start + duration;
  if (end > DAY_MAX) {
    end = DAY_MAX;
    start = end - duration;
  }
  if (start < 0) return null;
  const moved: SlotDef = { ...slot, start: fromMin(start), end: fromMin(end) };
  if (s.slots.some((other, i) => i !== from && overlaps(moved, other))) return { error: OVERLAP };
  return withSlotTimes(s, date, s.slots.map((sl, i) => (i === from ? moved : sl)));
}

/** drag a block onto another block — they trade start times, each keeps its length */
export function swapBlock(s: Struct, date: string, from: number, to: number): StructChange {
  const n = s.slots.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return null;
  const a = s.slots[from];
  const b = s.slots[to];
  const aEnd = toMin(b.start) + (toMin(a.end) - toMin(a.start));
  const bEnd = toMin(a.start) + (toMin(b.end) - toMin(b.start));
  if (aEnd > DAY_MAX || bEnd > DAY_MAX) return { error: OVERLAP };
  const newA: SlotDef = { ...a, start: b.start, end: fromMin(aEnd) };
  const newB: SlotDef = { ...b, start: a.start, end: fromMin(bEnd) };
  const others = s.slots.filter((_, i) => i !== from && i !== to);
  if (others.some((o) => overlaps(newA, o) || overlaps(newB, o))) return { error: OVERLAP };
  return withSlotTimes(s, date, s.slots.map((sl, i) => (i === from ? newA : i === to ? newB : sl)));
}

/* ---------------- rooms ---------------- */

export function addRoom(s: Struct): StructChange {
  return { struct: { rooms: [...s.rooms, `강의실 ${s.rooms.length + 1}`], slots: s.slots } };
}

/** rename a room; its cells follow the new name */
export function renameRoom(s: Struct, date: string, i: number, name: string): StructChange {
  const old = s.rooms[i];
  return {
    struct: { rooms: s.rooms.map((r, j) => (j === i ? name : r)), slots: s.slots },
    remap:
      name && name !== old
        ? (m) => remapDay(m, date, (c) => (c.room === old ? { ...c, room: name } : c))
        : undefined,
  };
}

/** remove a room and its cells (the last room can't go) */
export function deleteRoom(s: Struct, date: string, i: number): StructChange {
  if (s.rooms.length <= 1) return null;
  const gone = s.rooms[i];
  return {
    struct: { rooms: s.rooms.filter((_, j) => j !== i), slots: s.slots },
    remap: (m) => remapDay(m, date, (c) => (c.room === gone ? null : c)),
  };
}

/** drag a room header to a new column — cells key on the name, so no remap */
export function reorderRoom(s: Struct, from: number, to: number): StructChange {
  const n = s.rooms.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return null;
  const rooms = [...s.rooms];
  const [moved] = rooms.splice(from, 1);
  rooms.splice(to, 0, moved);
  return { struct: { rooms, slots: s.slots } };
}
