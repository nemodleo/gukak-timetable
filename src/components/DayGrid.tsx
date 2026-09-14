"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Cell, MemoLine, MemoSize, Pairing, SlotDef } from "@/lib/types";
import { gridGeom } from "@/lib/schedule";
import {
  durationH,
  fromMin,
  isPastMidnight,
  rangeLabel,
  rangeLabelShort,
} from "@/lib/time";
import { keyOf, type CellIndex } from "@/lib/cellIndex";
import { CellBody } from "./Cell";

const ROW_H = 27; // px per 30-min row

const MEMO_PX: Record<MemoSize, string> = {
  s: "text-[9px]",
  m: "text-[10.5px]",
  l: "text-[12.5px]",
};

export interface MemoCtl {
  mode: "none" | "read" | "edit";
  lines: Record<string, MemoLine>;
  onChange?: (hhmm: string, line: MemoLine | null) => void;
}

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
  onPaint?: (targets: { room: string; slot: number }[], value: "block" | "clear") => void;
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

  /* ---- paint drag ---- */
  const drag = useRef<{ value: "block" | "clear"; set: Set<string> } | null>(null);
  const [preview, setPreview] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!paintMode) return;
    const up = () => {
      if (drag.current && onPaint) {
        const targets = [...drag.current.set].map((k) => {
          const [r, s] = k.split(" ");
          return { room: r, slot: Number(s) };
        });
        if (targets.length) onPaint(targets, drag.current.value);
      }
      drag.current = null;
      setPreview(new Set());
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [paintMode, onPaint]);

  /* ---- drag-reorder room headers (columns have no inherent order) ---- */
  const [roomDrag, setRoomDrag] = useState<{ from: number; over: number | null } | null>(
    null,
  );

  /* ---- drag a time block to a new (empty) time — duration preserved.
   *  the grid places blocks by clock time, so this drags vertically onto
   *  an empty gap rather than reordering the underlying array. ---- */
  const [blockDragFrom, setBlockDragFrom] = useState<number | null>(null);
  const [blockDragOverGap, setBlockDragOverGap] = useState<number | null>(null);

  const pkey = (room: string, s: number) => `${room} ${s}`;
  const paintStart = (room: string, s: number) => {
    const cur = cellIndex.get(keyOf(date, room, s));
    const value: "block" | "clear" = cur?.kind === "block" ? "clear" : "block";
    drag.current = { value, set: new Set([pkey(room, s)]) };
    setPreview(new Set([pkey(room, s)]));
  };
  const paintEnter = (room: string, s: number) => {
    if (!drag.current) return;
    drag.current.set.add(pkey(room, s));
    setPreview(new Set(drag.current.set));
  };

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
              onDragStart={() => setBlockDragFrom(si)}
              onDragEndLabel={() => {
                setBlockDragFrom(null);
                setBlockDragOverGap(null);
              }}
            />
          );
        })}

        {/* room cells */}
        {slots.map((s, si) => {
          const { row, span } = geom.spanRows(s);
          return rooms.map((room, ri) => {
            const cell = cellIndex.get(keyOf(date, room, si));
            const inPreview = preview.has(pkey(room, si));
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
                    paintStart(room, si);
                  }}
                  onMouseEnter={() => paintEnter(room, si)}
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

/* ------------------------------------------------------------------ */

function RoomHeader({
  name,
  editable,
  onRename,
  onDelete,
  isSource,
  isOver,
  onDragStart,
  onDragOverHeader,
  onDropHeader,
  onDragEndHeader,
}: {
  name: string;
  editable: boolean;
  onRename: (v: string) => void;
  onDelete: () => void;
  isSource?: boolean;
  isOver?: boolean;
  onDragStart?: () => void;
  onDragOverHeader?: () => void;
  onDropHeader?: () => void;
  onDragEndHeader?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(name);
  const [prev, setPrev] = useState(name);
  if (prev !== name) {
    setPrev(name);
    setV(name);
  }
  if (!editable) {
    return (
      <div className="border-r px-1 py-1.5 text-center text-[11px] font-semibold text-ink-2">
        {name}
      </div>
    );
  }
  return (
    <div
      className={clsx(
        "group relative border-r px-1 py-1.5 text-center",
        isSource && "opacity-40",
        isOver && "outline outline-2 -outline-offset-2 outline-clay",
      )}
      draggable={!editing}
      title={!editing ? "드래그해서 강의실 순서 변경" : undefined}
      onDragStart={!editing ? onDragStart : undefined}
      onDragOver={
        !editing
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              onDragOverHeader?.();
            }
          : undefined
      }
      onDrop={
        !editing
          ? (e) => {
              e.preventDefault();
              onDropHeader?.();
            }
          : undefined
      }
      onDragEnd={!editing ? onDragEndHeader : undefined}
    >
      {editing ? (
        <input
          autoFocus
          value={v}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (v.trim() && v !== name) onRename(v.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setV(name);
              setEditing(false);
            }
          }}
          className="w-full rounded border border-clay bg-paper px-0.5 text-center text-[11px] font-semibold outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="클릭하여 이름 변경"
          className="w-full text-[11px] font-semibold text-ink-2"
        >
          {name}
        </button>
      )}
      {!editing && (
        <button
          type="button"
          onClick={onDelete}
          title="강의실 삭제"
          className="absolute -right-0.5 -top-0.5 hidden rounded-full bg-over px-1 text-[9px] leading-4 text-paper group-hover:block"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function BlockLabel({
  slot,
  editable,
  onRetime,
  onDelete,
  style,
  isDragging,
  onDragStart,
  onDragEndLabel,
}: {
  slot: SlotDef;
  editable: boolean;
  onRetime: (patch: Partial<SlotDef>) => void;
  onDelete: () => void;
  style: React.CSSProperties;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEndLabel?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const compact = durationH(slot.start, slot.end) < 1.5; // short block -> single line
  const late = isPastMidnight(slot.start) || isPastMidnight(slot.end);
  return (
    <div
      className={clsx(
        "group relative flex flex-col items-center justify-center border-b border-r bg-paper px-0.5 text-center",
        editing ? "z-40 gap-0.5 overflow-visible" : "z-20 overflow-hidden",
        !editing && "text-[9.5px] font-medium leading-[1.1] tabular-nums text-ink-3",
        isDragging && "opacity-40",
      )}
      style={style}
      draggable={editable && !editing}
      title={editable && !editing ? "드래그해서 다른(빈) 시간으로 이동" : undefined}
      onDragStart={editable && !editing ? onDragStart : undefined}
      onDragEnd={editable && !editing ? onDragEndLabel : undefined}
      onBlur={(e) => {
        // time change auto-confirms; close when focus leaves the editor
        if (editing && !e.currentTarget.contains(e.relatedTarget as Node)) {
          setEditing(false);
        }
      }}
    >
      {editable && editing ? (
        <>
          <input
            autoFocus
            type={late ? "text" : "time"}
            step={1800}
            defaultValue={slot.start}
            onBlur={(e) => e.target.value && e.target.value !== slot.start && onRetime({ start: e.target.value })}
            className="w-full rounded border border-clay bg-paper text-center text-[9px] tabular-nums outline-none"
          />
          <input
            type={late ? "text" : "time"}
            step={1800}
            defaultValue={slot.end}
            onBlur={(e) => e.target.value && e.target.value !== slot.end && onRetime({ end: e.target.value })}
            className="w-full rounded border border-clay bg-paper text-center text-[9px] tabular-nums outline-none"
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() => editable && setEditing(true)}
          className={clsx("leading-[1.1]", !compact && "whitespace-pre-line")}
          title={editable ? "클릭하여 시간 변경" : undefined}
        >
          {slot.label ||
            (compact
              ? rangeLabelShort(slot.start, slot.end)
              : rangeLabel(slot.start, slot.end))}
        </button>
      )}
      {editable && !editing && (
        <button
          type="button"
          onClick={onDelete}
          title="블록 삭제"
          className="absolute right-0 top-0 hidden rounded-full bg-over px-1 text-[9px] leading-4 text-paper group-hover:block"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** stable empty reference so MemoColumn's line-sync doesn't loop */
export const EMPTY_MEMO_LINES: Record<string, MemoLine> = {};

const MEMO_A_PX: Record<MemoSize, number> = { s: 8, m: 10, l: 12 };
const nextSize = (s: MemoSize): MemoSize =>
  s === "s" ? "m" : s === "m" ? "l" : "s";

/** the whole ruled memo column as ONE grid item — fixed row stack.
 *  each edit row keeps its red / size controls inline, right-aligned, with
 *  space reserved so focusing never shifts the layout. */
function MemoColumn({
  marks,
  rowH,
  lines,
  mode,
  onChange,
  style,
}: {
  marks: string[];
  rowH: number;
  lines: Record<string, MemoLine>;
  mode: "read" | "edit" | "none";
  onChange?: (hhmm: string, line: MemoLine | null) => void;
  style: React.CSSProperties;
}) {
  const [vals, setVals] = useState<Record<string, MemoLine>>(lines);
  const [prevLines, setPrevLines] = useState(lines);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  if (prevLines !== lines) {
    setPrevLines(lines);
    setVals(lines);
  }

  const commit = (mk: string, next: MemoLine | null) => {
    setVals((v) => {
      const n = { ...v };
      if (next && next.text.trim()) n[mk] = next;
      else delete n[mk];
      return n;
    });
    const tm = timers.current;
    if (tm.has(mk)) clearTimeout(tm.get(mk)!);
    tm.set(
      mk,
      setTimeout(() => {
        onChange?.(mk, next && next.text.trim() ? next : null);
      }, 450),
    );
  };

  const patch = (mk: string, p: Partial<MemoLine>) => {
    const cur = vals[mk] ?? { text: "" };
    commit(mk, { text: cur.text, red: cur.red, size: cur.size, ...p });
  };

  return (
    <div className="relative" style={style}>
      {marks.map((mk) => {
        const ln = vals[mk];
        const size = ln?.size ?? "m";
        if (mode === "read") {
          return (
            <div
              key={mk}
              className={clsx(
                "flex items-center overflow-hidden border-b border-dotted border-line-strong px-2 leading-tight",
                MEMO_PX[size],
                ln?.red ? "font-semibold text-over" : "text-ink-2",
              )}
              style={{ height: rowH }}
            >
              {ln?.text ?? ""}
            </div>
          );
        }
        return (
          <div
            key={mk}
            className="group flex items-center gap-1 border-b border-dotted border-line-strong pl-1.5 pr-1"
            style={{ height: rowH }}
          >
            <input
              value={ln?.text ?? ""}
              onChange={(e) => patch(mk, { text: e.target.value })}
              className={clsx(
                "min-w-0 flex-1 bg-transparent py-0.5 leading-tight outline-none placeholder:text-line",
                MEMO_PX[size],
                ln?.red ? "font-semibold text-over" : "text-ink-2",
              )}
            />
            <span
              data-no-capture
              className={clsx(
                "flex shrink-0 items-center gap-1 transition-opacity",
                ln?.text
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
              )}
            >
              <button
                type="button"
                title="빨간 강조"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => patch(mk, { red: !ln?.red })}
                className={clsx(
                  "h-2.5 w-2.5 rounded-full border",
                  ln?.red ? "border-over bg-over" : "border-line-strong",
                )}
              />
              <button
                type="button"
                title="글꼴 크기 (클릭하여 변경)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => patch(mk, { size: nextSize(size) })}
                className="w-3 shrink-0 text-center font-semibold leading-none text-clay/70 hover:text-clay"
                style={{ fontSize: MEMO_A_PX[size] }}
              >
                A
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
