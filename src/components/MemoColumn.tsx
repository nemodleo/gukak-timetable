"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import type { MemoLine, MemoSize } from "@/lib/types";

const MEMO_PX: Record<MemoSize, string> = {
  s: "text-[9px]",
  m: "text-[10.5px]",
  l: "text-[12.5px]",
};

/** stable empty reference so MemoColumn's line-sync doesn't loop */
export const EMPTY_MEMO_LINES: Record<string, MemoLine> = {};

const MEMO_A_PX: Record<MemoSize, number> = { s: 8, m: 10, l: 12 };
const nextSize = (s: MemoSize): MemoSize =>
  s === "s" ? "m" : s === "m" ? "l" : "s";

/** the whole ruled memo column as ONE grid item — fixed row stack.
 *  each edit row keeps its red / size controls inline, right-aligned, with
 *  space reserved so focusing never shifts the layout. */
export function MemoColumn({
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
