import { describe, expect, it } from "vitest";
import type { Cell } from "./types";
import { cellRow, keyOf } from "./cellIndex";
import {
  appendBlock,
  deleteBlock,
  deleteRoom,
  insertBlock,
  moveBlock,
  renameRoom,
  reorderRoom,
  retimeBlock,
  swapBlock,
  type CellMap,
  type Struct,
  type StructChange,
} from "./structOps";

const D = "2026-09-15";

function cell(room: string, slot: number, who: string, date = D): Cell {
  return {
    id: who,
    date,
    room,
    slot_index: slot,
    kind: "pairing",
    pairing_id: who,
    text: null,
    color: null,
    active: true,
  };
}

/** cells ordered the way the API returns them (date, room, slot ascending) */
function cellMap(cs: Cell[]): CellMap {
  return new Map(cs.map((c) => [keyOf(c.date, c.room, c.slot_index), c]));
}

/** "who@room:slot" for every cell, sorted — easy to compare */
function layout(m: CellMap): string[] {
  return [...m.values()].map((c) => `${c.pairing_id}@${c.room}:${c.slot_index}`).sort();
}

function apply(edit: StructChange, m: CellMap): Struct {
  if (!edit || "error" in edit) throw new Error("expected a struct edit");
  edit.remap?.(m);
  return edit.struct;
}

const s3: Struct = {
  rooms: ["I", "II"],
  slots: [
    { start: "09:00", end: "11:00" },
    { start: "11:00", end: "13:00" },
    { start: "13:00", end: "15:00" },
  ],
};

describe("insertBlock", () => {
  it("shifts later cells up without losing consecutive ones (regression)", () => {
    // the old in-place shift overwrote slot 2's moved cell with slot 3's
    const m = cellMap([cell("I", 1, "a"), cell("I", 2, "b"), cell("I", 3, "c")]);
    const s: Struct = {
      rooms: ["I"],
      slots: [
        { start: "06:00", end: "08:00" },
        { start: "08:00", end: "10:00" },
        { start: "12:00", end: "14:00" },
        { start: "14:00", end: "16:00" },
      ],
    };
    const next = apply(insertBlock(s, D, "10:00", "12:00"), m);
    expect(next.slots.map((x) => x.start)).toEqual(["06:00", "08:00", "10:00", "12:00", "14:00"]);
    expect(layout(m)).toEqual(["a@I:1", "b@I:3", "c@I:4"]);
  });

  it("leaves other dates alone", () => {
    const m = cellMap([cell("I", 0, "x", "2026-09-16")]);
    apply(insertBlock(s3, D, "07:00", "08:00"), m);
    expect(layout(m)).toEqual(["x@I:0"]);
  });
});

describe("deleteBlock", () => {
  it("drops the block's cells and shifts later ones down", () => {
    const m = cellMap([cell("I", 0, "a"), cell("I", 1, "b"), cell("II", 2, "c")]);
    const next = apply(deleteBlock(s3, D, 1), m);
    expect(next.slots).toHaveLength(2);
    expect(layout(m)).toEqual(["a@I:0", "c@II:1"]);
  });
});

describe("appendBlock / retimeBlock", () => {
  it("appends a 2h block after the last one", () => {
    const next = apply(appendBlock(s3), new Map());
    expect(next.slots.at(-1)).toEqual({ start: "15:00", end: "17:00" });
  });

  it("clamps a retime between neighbours", () => {
    const next = apply(retimeBlock(s3, 1, { start: "10:00", end: "14:00" }), new Map());
    expect(next.slots[1]).toEqual({ start: "11:00", end: "13:00" });
  });
});

describe("moveBlock", () => {
  const gapped: Struct = {
    rooms: ["I"],
    slots: [
      { start: "09:00", end: "11:00" },
      { start: "15:00", end: "17:00" },
    ],
  };

  it("moves a block into a gap, re-sorts, and its cells follow", () => {
    const m = cellMap([cell("I", 0, "early"), cell("I", 1, "late")]);
    const next = apply(moveBlock(gapped, D, 1, "12:00"), m);
    expect(next.slots).toEqual([
      { start: "09:00", end: "11:00" },
      { start: "12:00", end: "14:00" },
    ]);
    expect(layout(m)).toEqual(["early@I:0", "late@I:1"]);

    const m2 = cellMap([cell("I", 0, "early"), cell("I", 1, "late")]);
    const moved = apply(moveBlock(gapped, D, 0, "18:00"), m2);
    expect(moved.slots.map((x) => x.start)).toEqual(["15:00", "18:00"]);
    expect(layout(m2)).toEqual(["early@I:1", "late@I:0"]);
  });

  it("refuses to overlap another block", () => {
    expect(moveBlock(gapped, D, 0, "14:00")).toEqual({ error: expect.any(String) });
  });
});

describe("swapBlock", () => {
  it("trades two blocks' times and their cells", () => {
    const m = cellMap([cell("I", 0, "a"), cell("II", 2, "c")]);
    const next = apply(swapBlock(s3, D, 0, 2), m);
    expect(next.slots.map((x) => x.start)).toEqual(["09:00", "11:00", "13:00"]);
    expect(layout(m)).toEqual(["a@I:2", "c@II:0"]);
  });

  it("refuses when a longer block would run into a third one", () => {
    const s: Struct = {
      rooms: ["I"],
      slots: [
        { start: "09:00", end: "12:00" },
        { start: "12:00", end: "13:00" },
        { start: "13:00", end: "14:00" },
      ],
    };
    expect(swapBlock(s, D, 0, 1)).toEqual({ error: expect.any(String) });
  });

  it("is a no-op onto itself", () => {
    expect(swapBlock(s3, D, 1, 1)).toBeNull();
  });
});

describe("rooms", () => {
  it("rename carries the room's cells", () => {
    const m = cellMap([cell("I", 0, "a"), cell("II", 0, "b")]);
    const next = apply(renameRoom(s3, D, 0, "大"), m);
    expect(next.rooms).toEqual(["大", "II"]);
    expect(layout(m)).toEqual(["a@大:0", "b@II:0"]);
  });

  it("delete drops the room's cells but not the last room", () => {
    const m = cellMap([cell("I", 0, "a"), cell("II", 0, "b")]);
    apply(deleteRoom(s3, D, 0), m);
    expect(layout(m)).toEqual(["b@II:0"]);
    expect(deleteRoom({ rooms: ["I"], slots: [] }, D, 0)).toBeNull();
  });

  it("reorder needs no cell remap", () => {
    const edit = reorderRoom(s3, 0, 1);
    expect(edit && !("error" in edit) && edit.struct.rooms).toEqual(["II", "I"]);
    expect(edit && !("error" in edit) && edit.remap).toBeUndefined();
  });
});

describe("cellRow", () => {
  it("keeps color and the inactive flag", () => {
    const block: Cell = { ...cell("I", 0, "x"), kind: "block", pairing_id: null, text: "메모", color: "g", active: false };
    expect(cellRow(D, "I", 0, block)).toEqual({
      date: D,
      room: "I",
      slot_index: 0,
      kind: "block",
      pairing_id: null,
      text: "메모",
      color: "g",
      active: false,
    });
  });

  it("clears the slot for null", () => {
    expect(cellRow(D, "I", 0, null)).toEqual({ date: D, room: "I", slot_index: 0, kind: null });
  });
});
