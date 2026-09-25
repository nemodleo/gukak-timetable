import type { Cell } from "./types";

export type CellIndex = Map<string, Cell>;

export function keyOf(date: string, room: string, slot: number): string {
  return `${date}|${room}|${slot}`;
}

export function indexCells(cells: Cell[]): CellIndex {
  const m: CellIndex = new Map();
  for (const c of cells) m.set(keyOf(c.date, c.room, c.slot_index), c);
  return m;
}

/** the PUT /api/schedule row that recreates `cell` at (date, room, slot);
 *  null clears the slot. Carries every field — color and active included —
 *  so undo, drag-move and structural re-saves never silently reset them. */
export function cellRow(date: string, room: string, slot: number, cell: Cell | null) {
  if (!cell) return { date, room, slot_index: slot, kind: null };
  return {
    date,
    room,
    slot_index: slot,
    kind: cell.kind,
    pairing_id: cell.kind === "pairing" ? cell.pairing_id : null,
    text: cell.kind === "block" ? cell.text : null,
    color: cell.kind === "block" ? cell.color : null,
    active: cell.active,
  };
}

/** true if the cell has real content worth keeping when toggling active —
 *  a pairing assignment, or a block with a note/color. A content-less
 *  block (created purely to lock an otherwise-empty slot) doesn't. */
export function hasCellContent(c: Cell | undefined | null): boolean {
  if (!c) return false;
  if (c.kind === "pairing") return !!c.pairing_id;
  if (c.kind === "block") return !!(c.text || c.color);
  return false;
}

/** true if this cell should currently read as "비활성 지정" — either the
 *  active flag is explicitly off, or (for data from before that flag
 *  existed) it's a content-less lock-only block cell. */
export function isInactiveCell(c: Cell | undefined | null): boolean {
  if (!c) return false;
  if (c.active === false) return true;
  return c.kind === "block" && !hasCellContent(c);
}
