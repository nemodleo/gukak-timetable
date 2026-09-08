import clsx from "clsx";
import type { DayMemo, Pairing, SlotDef } from "@/lib/types";
import { fmtDayHeader, iso, parseIso, weekdayKo } from "@/lib/schedule";
import { type CellIndex } from "@/lib/cellIndex";
import { DayGrid, EMPTY_MEMO_LINES } from "./DayGrid";

export function DayPanel({
  date,
  rooms,
  slots,
  pairings,
  cellIndex,
  memos,
  size = "sm",
  memoMode = "none",
  captureId,
}: {
  date: string;
  rooms: string[];
  slots: SlotDef[];
  pairings: Pairing[];
  cellIndex: CellIndex;
  memos: DayMemo[];
  size?: "sm" | "lg";
  memoMode?: "none" | "read";
  captureId?: string;
}) {
  const d = parseIso(date);
  const memoLines = memos.find((m) => m.date === date)?.lines ?? EMPTY_MEMO_LINES;
  const isWknd = d.getDay() === 0 || d.getDay() === 6;

  return (
    <section
      id={captureId}
      className={clsx(
        "flex shrink-0 flex-col overflow-hidden rounded-lg border bg-paper",
        size === "lg" ? "w-full" : memoMode === "none" ? "w-[460px]" : "w-[680px]",
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b bg-clay-wash/60 px-3.5 py-2.5">
        <span
          className={clsx(
            "font-serif font-medium",
            size === "lg" ? "text-lg" : "text-[15px]",
            isWknd && "text-clay",
          )}
        >
          {fmtDayHeader(d)}
        </span>
      </header>

      <DayGrid
        date={date}
        rooms={rooms}
        slots={slots}
        cellIndex={cellIndex}
        pairings={pairings}
        memo={{ mode: memoMode, lines: memoLines }}
      />

      <footer className="flex items-center justify-between border-t px-3.5 py-1.5 text-[10px] text-line-strong">
        <span>{iso(d)}</span>
        <span>{weekdayKo(d)}요일</span>
      </footer>
    </section>
  );
}
