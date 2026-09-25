"use client";

import clsx from "clsx";
import type { Cell, MemoLine, Pairing } from "@/lib/types";
import { fmtDayHeader, parseIso } from "@/lib/schedule";
import type { Struct } from "@/lib/structOps";
import {
  DayGrid,
  type DnDCtl,
  type PaintTarget,
  type PaintValue,
  type StructEdit,
} from "../DayGrid";
import { LockIcon, UnlockIcon } from "../ui";

export type SaveStatus = "pending" | "saving" | "saved" | "error";

function SaveState({ state }: { state?: SaveStatus }) {
  if (!state) return null;
  const map = {
    pending: { t: "저장 대기…", c: "text-ink-3" },
    saving: { t: "저장 중…", c: "text-ink-3" },
    saved: { t: "저장됨", c: "text-clay" },
    error: { t: "저장 실패", c: "text-over" },
  } as const;
  const { t, c } = map[state];
  return <span className={clsx("text-[10px]", c)}>{t}</span>;
}

/** one day's card in the editor: header (date, approval badge, structure
 *  save state) + the grid. All editing behaviour comes in through props. */
export function EditableDay({
  date,
  wide,
  readOnly,
  locked,
  isApproved,
  isAdmin,
  onToggleApproval,
  struct,
  structEdit,
  hasOverride,
  saveState,
  onResetStruct,
  cells,
  pairings,
  memoLines,
  onCellClick,
  onMemoChange,
  paintMode,
  onPaint,
  dnd,
}: {
  date: string;
  wide?: boolean;
  readOnly?: boolean;
  /** 강사 입력 잠금(관리자는 항상 false로 내려옴) */
  locked?: boolean;
  /** 잠금과 무관한 실제 승인 상태 — 관리자 배지/버튼용 */
  isApproved?: boolean;
  isAdmin?: boolean;
  /** 관리자 전용 — 이 날짜 승인/잠금 토글 */
  onToggleApproval?: () => void;
  struct: Struct;
  /** grid structure editing (admin) — absent = no structure controls */
  structEdit?: StructEdit;
  hasOverride: boolean;
  saveState?: SaveStatus;
  onResetStruct: () => void;
  cells: Map<string, Cell>;
  pairings: Pairing[];
  memoLines: Record<string, MemoLine>;
  onCellClick?: (room: string, slot: number) => void;
  onMemoChange?: (hhmm: string, line: MemoLine | null) => void;
  paintMode: boolean;
  onPaint: (targets: PaintTarget[], value: PaintValue) => void;
  dnd?: DnDCtl;
}) {
  const canStruct = !!structEdit;

  return (
    <section
      id={`capday-${date}`}
      className={clsx(
        "flex shrink-0 flex-col overflow-hidden rounded-lg border bg-paper",
        wide ? "w-full max-w-[920px]" : "w-[640px]",
      )}
    >
      <header className="relative flex items-center gap-2 border-b bg-clay-wash/60 px-3.5 py-2">
        <span className="font-serif text-[15px] font-medium">{fmtDayHeader(parseIso(date))}</span>
        {isAdmin && onToggleApproval ? (
          <button
            type="button"
            onClick={onToggleApproval}
            title={isApproved ? "클릭하여 다시 잠금" : "클릭하여 승인(강사 입력 허용)"}
            data-no-capture
            className={clsx(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
              isApproved
                ? "border-line-strong text-ink-3 hover:bg-paper-2"
                : "border-clay bg-clay-wash text-clay hover:bg-clay/10",
            )}
          >
            {isApproved ? (
              <UnlockIcon className="h-3 w-3 shrink-0" />
            ) : (
              <LockIcon className="h-3 w-3 shrink-0" />
            )}
            {isApproved ? "승인됨" : "승인 대기"}
          </button>
        ) : (
          locked && (
            <span
              className="flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 text-[10.5px] font-medium text-ink-3"
              title="관리자가 승인하기 전까지 강사는 편집할 수 없습니다"
              data-no-capture
            >
              <LockIcon className="h-3 w-3 shrink-0" />
              승인 대기
            </span>
          )
        )}
        <div
          className="absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center gap-2"
          data-no-capture
        >
          {canStruct && <SaveState state={saveState} />}
          {canStruct && hasOverride && (
            <button
              type="button"
              onClick={onResetStruct}
              className="rounded border border-line-strong px-1.5 py-0.5 text-[10px] text-ink-3 hover:bg-paper-2"
            >
              기본값
            </button>
          )}
        </div>
      </header>

      <DayGrid
        date={date}
        rooms={struct.rooms}
        slots={struct.slots}
        cellIndex={cells}
        pairings={pairings}
        memo={{
          mode: readOnly || locked ? "read" : "edit",
          lines: memoLines,
          onChange: onMemoChange,
        }}
        editable={!readOnly && !locked}
        rowH={wide ? 19 : 15}
        paintMode={paintMode}
        onCellClick={onCellClick}
        onPaint={onPaint}
        dnd={dnd}
        structEdit={structEdit}
      />
    </section>
  );
}
