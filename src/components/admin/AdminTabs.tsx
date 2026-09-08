"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Cell, DayConfig, DayMemo, Pairing, Settings } from "@/lib/types";
import { ymKey } from "@/lib/schedule";
import { SettingsForm } from "./SettingsForm";
import { RosterEditor } from "./RosterEditor";
import { DataPanel } from "./DataPanel";
import { ScheduleBoard } from "../ScheduleBoard";

const TABS = ["시간표 편집", "명단", "설정", "데이터"] as const;
type Tab = (typeof TABS)[number];

export function AdminTabs({
  settings,
  pairings,
  cells,
  memos,
  dayConfigs,
  year,
  month,
  role,
}: {
  settings: Settings;
  pairings: Pairing[];
  cells: Cell[];
  memos: DayMemo[];
  dayConfigs: DayConfig[];
  year: number;
  month: number;
  role: "admin" | "instructor" | null;
  configured?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("시간표 편집");

  return (
    <div className="space-y-6">
      <div className="flex w-fit max-w-full gap-1 overflow-x-auto scroll-thin rounded-full border bg-paper p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
              tab === t ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "시간표 편집" && (
        <ScheduleBoard
          role={role}
          settings={settings}
          pairings={pairings}
          initialCells={cells}
          initialMemos={memos}
          initialConfigs={dayConfigs}
          year={year}
          month={month}
        />
      )}
      {tab === "명단" && <RosterEditor defaultYm={ymKey(year, month)} />}
      {tab === "설정" && <SettingsForm initial={settings} />}
      {tab === "데이터" && <DataPanel />}
    </div>
  );
}
