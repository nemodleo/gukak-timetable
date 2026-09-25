"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Cell, CellColor, Pairing } from "@/lib/types";
import { ymOf } from "@/lib/schedule";
import { CELL_COLOR_OPTIONS, blockCellBg, inactiveBackgroundStyle } from "@/lib/colors";
import { useInactiveStyle } from "@/lib/inactiveStyleContext";

/** the cell being edited */
export type CellDraft = { date: string; room: string; slot: number };

/** what the editor saves — a 학생(교사) pairing, a 비활성 note, or kind null = 칸 비우기 */
export type CellEdit = {
  kind: "pairing" | "block" | null;
  pairing_id?: string | null;
  text?: string | null;
  color?: CellColor | null;
};

/** modal for one cell: pick a pairing, or (admin) write a 비활성 note + tint */
export function CellEditor({
  draft,
  pairings,
  canBlock,
  current,
  onClose,
  onSave,
}: {
  draft: CellDraft;
  pairings: Pairing[];
  /** 비활성 탭까지 보여줄지 (관리자) */
  canBlock: boolean;
  current?: Cell;
  onClose: () => void;
  onSave: (edit: CellEdit) => void;
}) {
  const inactive = useInactiveStyle();
  const modes = canBlock
    ? (["pairing", "block"] as const)
    : (["pairing"] as const);
  const [mode, setMode] = useState<"pairing" | "block">(
    current?.kind === "block" && canBlock ? "block" : "pairing",
  );
  const [pid, setPid] = useState<string>(current?.pairing_id ?? "");
  const [text, setText] = useState<string>(current?.text ?? "");
  const [color, setColor] = useState<CellColor | null>(current?.color ?? null);
  const [q, setQ] = useState("");
  // only offer the roster for the month this cell falls in (a week view may hold
  // two months' rosters); fall back to all if that month has none loaded.
  const ym = ymOf(draft.date);
  const monthPairings = pairings.some((p) => p.ym === ym)
    ? pairings.filter((p) => p.ym === ym)
    : pairings;
  const filtered = monthPairings.filter(
    (p) => !q || p.label.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-paper p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h3 className="font-serif text-[15px] font-medium">
            {draft.date} · {draft.room} · {draft.slot + 1}번째 블록
          </h3>
          <button type="button" onClick={onClose} className="text-ink-3 hover:text-ink">
            ✕
          </button>
        </div>

        {modes.length > 1 && (
          <div className="mt-4 flex gap-1 rounded-full border p-1 text-[12px]">
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={clsx(
                  "flex-1 rounded-full px-2.5 py-1.5",
                  mode === m ? "bg-ink text-paper" : "text-ink-2",
                )}
              >
                {m === "pairing" ? "학생(교사)" : "비활성"}
              </button>
            ))}
          </div>
        )}

        {mode === "pairing" ? (
          <div className="mt-3 space-y-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="검색"
              className="w-full rounded-md border border-line-strong bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-clay"
            />
            <select
              size={7}
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              className="w-full rounded-md border border-line-strong bg-paper p-1 text-[13px] outline-none focus:border-clay"
            >
              {filtered.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="비활성 메모 (선택) — 예) 6:20-8 성대k 김"
              className="w-full resize-y rounded-md border border-line-strong bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-clay"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-3">배경</span>
              <button
                type="button"
                title="기본 (설정의 비활성 무늬)"
                onClick={() => setColor(null)}
                className={clsx(
                  "h-6 w-6 rounded border text-[10px] text-ink-3",
                  color == null ? "border-clay ring-1 ring-clay" : "border-line-strong",
                )}
                style={inactiveBackgroundStyle(
                  inactive.pattern,
                  inactive.bgColor,
                  inactive.patternColor,
                )}
              />
              {CELL_COLOR_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  title={o.label}
                  onClick={() => setColor(o.key)}
                  className={clsx(
                    "h-6 w-6 rounded border",
                    color === o.key
                      ? "border-clay ring-1 ring-clay"
                      : "border-line-strong",
                  )}
                  style={{ background: blockCellBg[o.key] }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSave({ kind: null })}
            className="text-[12px] text-over/80 hover:text-over"
          >
            칸 비우기
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line-strong px-3 py-1.5 text-[13px] text-ink-2"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() =>
                mode === "pairing"
                  ? onSave({ kind: "pairing", pairing_id: pid || null })
                  : onSave({ kind: "block", text: text.trim() || null, color })
              }
              className="rounded-md bg-ink px-3 py-1.5 text-[13px] text-paper"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
