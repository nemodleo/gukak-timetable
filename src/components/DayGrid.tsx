"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Cell, MemoLine, Pairing, SlotDef } from "@/lib/types";
import { gridGeom } from "@/lib/schedule";
import { fromMin } from "@/lib/time";
import { isInactiveCell, keyOf, type CellIndex } from "@/lib/cellIndex";
import { usePaintDrag } from "@/lib/usePaintDrag";
import { CellBody } from "./Cell";
import { BlockLabel, RoomHeader } from "./GridHeaders";
import { MemoColumn } from "./MemoColumn";

export { EMPTY_MEMO_LINES } from "./MemoColumn";

const ROW_H = 27; // px per 30-min row

export interface MemoCtl {
  mode: "none" | "read" | "edit";
  lines: Record<string, MemoLine>;
  onChange?: (hhmm: string, line: MemoLine | null) => void;
}

/** one cell addressed for 비활성 지정 */
export type PaintTarget = { room: string; slot: number };
export type PaintValue = "deactivate" | "activate";

export interface StructEdit {
  onRenameRoom: (i: number, name: string) => void;
  onDeleteRoom: (i: number) => void;
  onAddRoom: () => void;
  /** drag a room header to reorder it (columns) */
  onReorderRoom: (from: number, to: number) => void;
  onRetimeBlock: (i: number, patch: Partial<SlotDef>) => void;
  onDeleteBlock: (i: number) => void;
  onAddBlock: () => void;
  onInsertBlock: (start: string, end: string) => void;
  /** drag a time block's label onto an empty gap to reschedule it (duration preserved) */
  onMoveBlock: (from: number, newStart: string) => void;
  /** drag a time block's label onto ANOTHER block to swap their times —
   *  this is what makes every row a valid drop target (parity with room
   *  headers, which can always be dropped onto each other), since empty
   *  gaps are rare in a fully-booked real schedule. */
  onSwapBlock: (from: number, to: number) => void;
}

/** drag-to-move a cell's assignment to another room/time (optionally another day) */
export interface DnDCtl {
  canDrag: (cell: Cell | undefined) => boolean;
  isSource: (room: string, slot: number) => boolean;
  isOver: (room: string, slot: number) => boolean;
  onDragStart: (room: string, slot: number) => void;
  onDragOver: (room: string, slot: number) => void;
  onDrop: (room: string, slot: number) => void;
  onDragEnd: () => void;
}

export function DayGrid({
  date,
  rooms,
  slots,
  cellIndex,
  pairings,
  memo,
  editable = false,
  paintMode = false,
  onCellClick,
  onPaint,
  structEdit,
  dnd,
  fallback,
  rowH = ROW_H,
}: {
  date: string;
  rooms: string[];
  slots: SlotDef[];
  cellIndex: CellIndex;
  pairings: Pairing[];
  memo: MemoCtl;
  editable?: boolean;
  paintMode?: boolean;
  onCellClick?: (room: string, slotIndex: number) => void;
  onPaint?: (targets: PaintTarget[], value: PaintValue) => void;
  structEdit?: StructEdit;
  dnd?: DnDCtl;
  fallback?: { start: string; end: string };
  rowH?: number;
}) {
  const pById = new Map(pairings.map((p) => [p.id, p]));
  const geom = gridGeom(slots, fallback?.start ?? "06:00", fallback?.end ?? "22:00");

  const covered = new Array(geom.rows).fill(false);
  slots.forEach((s) => {
    const { row, span } = geom.spanRows(s);
    for (let i = row; i < row + span && i < geom.rows; i++) covered[i] = true;
  });

  // contiguous uncovered ranges — "deleted"/empty time bands you can click to fill
  const gaps: Array<{ from: number; to: number }> = [];
  for (let i = 0; i < geom.rows; ) {
    if (covered[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < geom.rows && !covered[j]) j++;
    gaps.push({ from: i, to: j });
    i = j;
  }
  const markAt = (row: number) =>
    row < geom.marks.length ? geom.marks[row] : fromMin(geom.endMin);

  const showMemo = memo.mode !== "none";
  const showStruct = editable && !!structEdit;
  const plusCol = 2 + rooms.length;
  const memoCol = plusCol + (showStruct ? 1 : 0);
  const cols =
    `${showStruct ? 58 : 72}px repeat(${rooms.length}, minmax(${showStruct ? 58 : 74}px, 1fr))` +
    (showStruct ? " 22px" : "") +
    (showMemo ? ` ${showStruct ? 178 : 208}px` : "");

  /* ---- paint drag (비활성 지정) ---- */
  const isInactiveAt = (t: PaintTarget) => isInactiveCell(cellIndex.get(keyOf(date, t.room, t.slot)));
  const paint = usePaintDrag<PaintTarget, PaintValue>(
    paintMode,
    (t) => keyOf(date, t.room, t.slot),
    (targets, value) => onPaint?.(targets, value),
  );
  /** 행(시간)·열(강의실) 이름 클릭 — 전부 비활성이면 해제, 아니면 전부 비활성으로 */
  const paintAll = (targets: PaintTarget[]) =>
    onPaint?.(targets, targets.every(isInactiveAt) ? "activate" : "deactivate");

  /* ---- drag-reorder room headers (columns have no inherent order) ---- */
  const [roomDrag, setRoomDrag] = useState<{ from: number; over: number | null } | null>(
    null,
  );

  /* ---- drag a time block to a new (empty) time — duration preserved.
   *  the grid places blocks by clock time, so this drags vertically onto
   *  an empty gap rather than reordering the underlying array. ---- */
  const [blockDragFrom, setBlockDragFrom] = useState<number | null>(null);
  const [blockDragOverGap, setBlockDragOverGap] = useState<number | null>(null);
  const [blockDragOverBlock, setBlockDragOverBlock] = useState<number | null>(null);


  return (
    <div
      className="bg-paper text-[11px]"
      style={paintMode ? { userSelect: "none", cursor: "crosshair" } : undefined}
    >
      {/* header */}
      <div className="grid border-b bg-paper-2" style={{ gridTemplateColumns: cols }}>
        <div className="border-r px-1.5 py-1.5 text-[10px] font-semibold text-ink-3">시간</div>
        {rooms.map((r, i) => (
          <RoomHeader
            key={i}
            name={r}
            editable={showStruct}
            onRename={(v) => structEdit!.onRenameRoom(i, v)}
            onDelete={() => structEdit!.onDeleteRoom(i)}
            isSource={roomDrag?.from === i}
            isOver={roomDrag != null && roomDrag.from !== i && roomDrag.over === i}
            onDragStart={() => setRoomDrag({ from: i, over: null })}
            onDragOverHeader={() =>
              setRoomDrag((d) => (d ? { ...d, over: i } : d))
            }
            onDropHeader={() => {
              if (roomDrag && roomDrag.from !== i)
                structEdit!.onReorderRoom(roomDrag.from, i);
              setRoomDrag(null);
            }}
            onDragEndHeader={() => setRoomDrag(null)}
            paintMode={paintMode}
            onPaintColumn={() => paintAll(slots.map((_, slot) => ({ room: r, slot })))}
          />
        ))}
        {showStruct && (
          <button
            type="button"
            data-no-capture
            onClick={structEdit!.onAddRoom}
            title="강의실 추가"
            className="border-r bg-paper text-[15px] font-medium text-clay hover:bg-paper-2"
            style={{ gridColumn: String(plusCol) }}
          >
            +
          </button>
        )}
        {showMemo && (
          <div
            className="px-2 py-1.5 text-center text-[11px] font-semibold text-ink-2"
            style={{ gridColumn: String(memoCol) }}
          >
            메모
          </div>
        )}
      </div>

      {/* body */}
      <div
        className="relative grid bg-paper"
        style={{
          gridTemplateColumns: cols,
          gridTemplateRows: `repeat(${geom.rows + (showStruct ? 1 : 0)}, ${rowH}px)`,
          gridAutoRows: `${rowH}px`, // implicit rows keep the 30-min height (never clips)
          alignContent: "start", // never stretch rows when the panel is taller
        }}
      >
        {/* "+" gutter — just the two vertical separators (same 1px table line) */}
        {showStruct && (
          <div
            className="border-r"
            style={{ gridColumn: `${plusCol}`, gridRow: "1 / -1" }}
          />
        )}

        {/* base 30-min lines + gap shading (not drawn through the + gutter) */}
        {geom.marks.map((mk, i) => (
          <div
            key={`bg-${i}`}
            className={clsx(
              "border-b border-line/70",
              i % 2 === 1 && "border-b-line",
              !covered[i] && "bg-paper-2/50",
            )}
            style={{
              gridColumn: showStruct ? `1 / ${plusCol}` : "1 / -1",
              gridRow: `${i + 1} / span 1`,
            }}
          />
        ))}

        {/* hour ticks */}
        {geom.marks.map((mk, i) =>
          mk.endsWith(":00") ? (
            <div
              key={`tick-${i}`}
              className="pointer-events-none z-10 px-1 text-[9px] tabular-nums text-line-strong"
              style={{ gridColumn: "1", gridRow: `${i + 1} / span 1` }}
            >
              {Number(mk.slice(0, 2)) % 24}
            </div>
          ) : null,
        )}

        {/* empty / deleted time bands — hover to add a block, or drop a
            dragged block here to move it (start snaps to the gap's start,
            duration is preserved) */}
        {showStruct &&
          gaps.map((g, k) => (
            <button
              key={`gap-${k}`}
              type="button"
              title={
                blockDragFrom != null
                  ? "여기로 이동"
                  : "이 시간에 블록 추가"
              }
              onClick={() => {
                if (blockDragFrom != null) return; // drag/drop only, not a click
                structEdit!.onInsertBlock(markAt(g.from), markAt(g.to));
              }}
              draggable={false}
              onDragOver={
                blockDragFrom != null
                  ? (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (blockDragOverGap !== k) setBlockDragOverGap(k);
                    }
                  : undefined
              }
              onDragLeave={
                blockDragFrom != null
                  ? () => setBlockDragOverGap((v) => (v === k ? null : v))
                  : undefined
              }
              onDrop={
                blockDragFrom != null
                  ? (e) => {
                      e.preventDefault();
                      structEdit!.onMoveBlock(blockDragFrom, markAt(g.from));
                      setBlockDragFrom(null);
                      setBlockDragOverGap(null);
                    }
                  : undefined
              }
              className={clsx(
                "group/gap z-20 flex items-center justify-center bg-transparent hover:bg-clay-wash/70",
                blockDragFrom != null &&
                  blockDragOverGap === k &&
                  "outline outline-2 -outline-offset-2 outline-clay",
              )}
              style={{
                gridColumn: `1 / ${plusCol}`,
                gridRow: `${g.from + 1} / span ${g.to - g.from}`,
              }}
            >
              <span className="text-[15px] text-clay opacity-0 transition-opacity group-hover/gap:opacity-100">
                ＋
              </span>
            </button>
          ))}

        {/* block time labels */}
        {slots.map((s, si) => {
          const { row, span } = geom.spanRows(s);
          return (
            <BlockLabel
              key={`lab-${si}`}
              slot={s}
              editable={showStruct}
              onRetime={(patch) => structEdit!.onRetimeBlock(si, patch)}
              onDelete={() => structEdit!.onDeleteBlock(si)}
              style={{ gridColumn: "1", gridRow: `${row + 1} / span ${span}` }}
              isDragging={blockDragFrom === si}
              isOverTarget={blockDragFrom != null && blockDragFrom !== si && blockDragOverBlock === si}
              onDragStart={() => setBlockDragFrom(si)}
              onDragEndLabel={() => {
                setBlockDragFrom(null);
                setBlockDragOverGap(null);
                setBlockDragOverBlock(null);
              }}
              onDragOverBlock={
                blockDragFrom != null && blockDragFrom !== si
                  ? (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (blockDragOverBlock !== si) setBlockDragOverBlock(si);
                    }
                  : undefined
              }
              onDragLeaveBlock={
                blockDragFrom != null && blockDragFrom !== si
                  ? () => setBlockDragOverBlock((v) => (v === si ? null : v))
                  : undefined
              }
              onDropBlock={
                blockDragFrom != null && blockDragFrom !== si
                  ? (e) => {
                      e.preventDefault();
                      structEdit!.onSwapBlock(blockDragFrom, si);
                      setBlockDragFrom(null);
                      setBlockDragOverBlock(null);
                    }
                  : undefined
              }
              paintMode={paintMode}
              onPaintRow={() => paintAll(rooms.map((room) => ({ room, slot: si })))}
            />
          );
        })}

        {/* room cells */}
        {slots.map((s, si) => {
          const { row, span } = geom.spanRows(s);
          return rooms.map((room, ri) => {
            const cell = cellIndex.get(keyOf(date, room, si));
            const inPreview = paint.isPreviewed({ room, slot: si });
            const style = {
              gridColumn: `${2 + ri}`,
              gridRow: `${row + 1} / span ${span}`,
            } as const;
            const inner = <CellBody cell={cell} pairing={cell?.pairing_id ? pById.get(cell.pairing_id) : undefined} size="sm" />;

            if (paintMode) {
              return (
                <div
                  key={`c-${si}-${ri}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const t = { room, slot: si };
                    paint.start(t, isInactiveAt(t) ? "activate" : "deactivate");
                  }}
                  onMouseEnter={() => paint.enter({ room, slot: si })}
                  className={clsx(
                    "z-20 flex items-stretch border-b border-r bg-paper",
                    inPreview && "outline outline-2 -outline-offset-2 outline-clay",
                  )}
                  style={style}
                >
                  {inner}
                </div>
              );
            }
            const draggableHere = !!dnd && dnd.canDrag(cell);
            const isSource = !!dnd && dnd.isSource(room, si);
            const isOver = !!dnd && dnd.isOver(room, si);
            return editable ? (
              <button
                key={`c-${si}-${ri}`}
                type="button"
                onClick={() => onCellClick?.(room, si)}
                draggable={draggableHere}
                onDragStart={
                  draggableHere ? () => dnd!.onDragStart(room, si) : undefined
                }
                onDragOver={
                  dnd
                    ? (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        dnd.onDragOver(room, si);
                      }
                    : undefined
                }
                onDrop={
                  dnd
                    ? (e) => {
                        e.preventDefault();
                        dnd.onDrop(room, si);
                      }
                    : undefined
                }
                onDragEnd={dnd ? () => dnd.onDragEnd() : undefined}
                className={clsx(
                  "group/cell relative z-20 flex items-stretch border-b border-r bg-paper text-left transition-colors hover:bg-clay-wash",
                  draggableHere && "cursor-grab active:cursor-grabbing",
                  isSource && "opacity-40",
                  isOver && "outline outline-2 -outline-offset-2 outline-clay",
                )}
                style={style}
              >
                {cell ? (
                  inner
                ) : (
                  <span className="flex w-full items-center justify-center text-[13px] text-clay opacity-0 transition-opacity group-hover/cell:opacity-100">
                    ＋
                  </span>
                )}
              </button>
            ) : (
              <div
                key={`c-${si}-${ri}`}
                className="z-20 flex items-stretch border-b border-r bg-paper"
                style={style}
              >
                {inner}
              </div>
            );
          });
        })}

        {/* memo — one column item, rows stacked inside; toolbar is absolute (no reflow) */}
        {showMemo && (
          <MemoColumn
            marks={geom.marks}
            rowH={rowH}
            lines={memo.lines}
            mode={memo.mode}
            onChange={memo.onChange}
            style={{ gridColumn: `${memoCol}`, gridRow: `1 / ${geom.rows + 1}` }}
          />
        )}

        {/* add-block "+" — mirrors the add-room "+" (bare glyph in a table cell) */}
        {showStruct && (
          <button
            type="button"
            data-no-capture
            onClick={structEdit!.onAddBlock}
            title="시간 블록 추가"
            className="z-20 border-r border-t bg-paper text-[15px] font-medium text-clay hover:bg-paper-2"
            style={{ gridColumn: "1", gridRow: `${geom.rows + 1} / span 1` }}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
