"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Cell, DayConfig, DayMemo, Pairing, Settings } from "@/lib/types";
import { ScheduleEditor } from "./admin/ScheduleEditor";
import { StatsSidebar } from "./StatsSidebar";

type Role = "admin" | "instructor" | "viewer" | null;

interface EditorProps {
  settings: Settings;
  pairings: Pairing[];
  initialCells: Cell[];
  initialMemos: DayMemo[];
  initialConfigs: DayConfig[];
  approvedDates: string[];
  year: number;
  month: number;
  initialWeekKey?: string;
  dayOnly?: string;
}

/** role-aware wrapper:
 *  - viewer        → read-only (학생·학부모, 열람 비밀번호)
 *  - instructor    → 보기 / 편집 toggle, cell + memo editing
 *  - admin         → + grid structure editing & drag-paint */
export function ScheduleBoard({
  role,
  ...editorProps
}: { role: Role } & EditorProps) {
  const editor = role === "admin" || role === "instructor";
  const [mode, setMode] = useState<"view" | "edit">(editor ? "edit" : "view");
  const isAdmin = role === "admin";

  return (
    <div
      className={clsx(
        "flex flex-col gap-5",
        editor && "lg:flex-row-reverse lg:items-start",
      )}
    >
      <div className="min-w-0 space-y-3 lg:flex-1">
        <ScheduleEditor
          {...editorProps}
          isAdmin={isAdmin}
          readOnly={mode === "view" || !editor}
          viewToggle={
            editor && (
              <div
                className="flex shrink-0 gap-1 rounded-full border bg-paper p-1 text-[13px]"
                data-no-capture
              >
                {(["view", "edit"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={clsx(
                      "whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors",
                      mode === m ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2",
                    )}
                  >
                    {m === "view" ? "보기" : "편집"}
                  </button>
                ))}
              </div>
            )
          }
        />
      </div>

      {/* 강사·관리자만 — 시간표 옆에서 바로 확인, 모바일에서는 아래로 */}
      {editor && (
        <aside className="lg:w-64 lg:shrink-0" data-no-capture>
          <StatsSidebar
            year={editorProps.year}
            month={editorProps.month}
            settings={editorProps.settings}
          />
        </aside>
      )}
    </div>
  );
}
