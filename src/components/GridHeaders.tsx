"use client";

/** the two kinds of grid header in DayGrid — room names across the top and
 *  time-block labels down the side — with their rename/retime editors,
 *  drag handles and 비활성 지정 click targets. */
import { useState } from "react";
import clsx from "clsx";
import type { SlotDef } from "@/lib/types";
import { durationH, isPastMidnight, rangeLabel, rangeLabelShort } from "@/lib/time";

export function RoomHeader({
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
  paintMode,
  onPaintColumn,
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
  /** 비활성 지정 모드 중엔 이름 드래그·변경 대신 열 전체를 토글한다 */
  paintMode?: boolean;
  onPaintColumn?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(name);
  const [prev, setPrev] = useState(name);
  if (prev !== name) {
    setPrev(name);
    setV(name);
  }
  if (paintMode) {
    return (
      <button
        type="button"
        onClick={onPaintColumn}
        title="클릭하여 이 강의실 전체 비활성 지정/해제"
        className="border-r bg-paper px-1 py-1.5 text-center text-[11px] font-semibold text-ink-2 hover:bg-clay-wash/70"
      >
        {name}
      </button>
    );
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

export function BlockLabel({
  slot,
  editable,
  onRetime,
  onDelete,
  style,
  isDragging,
  onDragStart,
  onDragEndLabel,
  isOverTarget,
  onDragOverBlock,
  onDragLeaveBlock,
  onDropBlock,
  paintMode,
  onPaintRow,
}: {
  slot: SlotDef;
  editable: boolean;
  onRetime: (patch: Partial<SlotDef>) => void;
  onDelete: () => void;
  style: React.CSSProperties;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEndLabel?: () => void;
  /** true while another block is being dragged and hovering over this one */
  isOverTarget?: boolean;
  onDragOverBlock?: (e: React.DragEvent) => void;
  onDragLeaveBlock?: () => void;
  onDropBlock?: (e: React.DragEvent) => void;
  /** 비활성 지정 모드 중엔 시간 이동/변경 대신 이 시간대(모든 방)를 토글한다 */
  paintMode?: boolean;
  onPaintRow?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const compact = durationH(slot.start, slot.end) < 1.5; // short block -> single line
  const late = isPastMidnight(slot.start) || isPastMidnight(slot.end);
  if (paintMode) {
    return (
      <button
        type="button"
        style={style}
        onClick={onPaintRow}
        title="클릭하여 이 시간대 전체(모든 방) 비활성 지정/해제"
        className={clsx(
          "z-20 flex items-center justify-center overflow-hidden border-b border-r bg-paper px-0.5 text-center text-[9.5px] font-medium leading-[1.1] tabular-nums text-ink-3 hover:bg-clay-wash/70",
          !compact && "whitespace-pre-line",
        )}
      >
        {slot.label || (compact ? rangeLabelShort(slot.start, slot.end) : rangeLabel(slot.start, slot.end))}
      </button>
    );
  }
  return (
    <div
      className={clsx(
        "group relative flex flex-col items-center justify-center border-b border-r bg-paper px-0.5 text-center",
        editing ? "z-40 gap-0.5 overflow-visible" : "z-20 overflow-hidden",
        !editing && "text-[9.5px] font-medium leading-[1.1] tabular-nums text-ink-3",
        isDragging && "opacity-40",
        isOverTarget && "outline outline-2 -outline-offset-2 outline-clay",
      )}
      style={style}
      draggable={editable && !editing}
      title={
        editable && !editing
          ? "드래그해서 다른 시간으로 이동(다른 블록 위에 놓으면 서로 시간을 바꿈)"
          : undefined
      }
      onDragStart={editable && !editing ? onDragStart : undefined}
      onDragEnd={editable && !editing ? onDragEndLabel : undefined}
      onDragOver={editable && !editing ? onDragOverBlock : undefined}
      onDragLeave={editable && !editing ? onDragLeaveBlock : undefined}
      onDrop={editable && !editing ? onDropBlock : undefined}
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
