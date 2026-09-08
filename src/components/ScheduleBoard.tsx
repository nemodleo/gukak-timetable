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
      {loggedIn && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]" data-no-capture>
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
        </div>
      )}

      <ScheduleEditor
        {...editorProps}
        isAdmin={isAdmin}
        readOnly={mode === "view" || !loggedIn}
      />
    </div>
  );
}
