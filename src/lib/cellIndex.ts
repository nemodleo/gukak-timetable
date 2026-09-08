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
