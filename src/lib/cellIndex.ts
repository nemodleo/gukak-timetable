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
