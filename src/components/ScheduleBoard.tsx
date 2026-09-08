"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Cell, DayConfig, DayMemo, Pairing, Settings } from "@/lib/types";
import { ScheduleEditor } from "./admin/ScheduleEditor";

type Role = "admin" | "instructor" | null;

interface EditorProps {
  settings: Settings;
  pairings: Pairing[];
  initialCells: Cell[];
  initialMemos: DayMemo[];
  initialConfigs: DayConfig[];
  year: number;
  month: number;
  initialWeekKey?: string;
  dayOnly?: string;
}

/** role-aware wrapper:
 *  - not logged in → read-only (학생); log in from the header 강사/관리자 button
 *  - instructor    → 보기 / 편집 toggle, cell + memo editing
 *  - admin         → + grid structure editing & drag-paint */
export function ScheduleBoard({
  role,
  ...editorProps
}: { role: Role } & EditorProps) {
  const [mode, setMode] = useState<"view" | "edit">(role ? "edit" : "view");
  const isAdmin = role === "admin";
  const loggedIn = role != null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px]" data-no-capture>
        {loggedIn ? (
          <>
            <div className="flex gap-1 rounded-full border bg-paper p-1">
              {(["view", "edit"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={clsx(
                    "rounded-full px-3.5 py-1.5 transition-colors",
                    mode === m ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2",
                  )}
                >
                  {m === "view" ? "보기" : "편집"}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-ink-3">
              {mode === "view"
                ? "읽기 전용"
                : isAdmin
                  ? "관리자 · 배정 + 구조 편집"
                  : "강사 · 배정 입력 (구조 변경은 관리자)"}
            </span>
          </>
        ) : (
          <span className="rounded-full bg-paper-2 px-3 py-1.5 text-[12px] text-ink-3">
            읽기 전용 — 편집하려면 오른쪽 위 <strong className="text-ink-2">강사</strong> 로그인
          </span>
        )}
      </div>

      <ScheduleEditor
        {...editorProps}
        isAdmin={isAdmin}
        readOnly={mode === "view" || !loggedIn}
      />
    </div>
  );
}
