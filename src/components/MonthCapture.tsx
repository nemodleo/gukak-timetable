"use client";

import { useEffect, useRef, useState } from "react";
import type { Cell, DayConfig, DayMemo, Pairing, Settings } from "@/lib/types";
import {
  indexDayConfigs,
  parseIso,
  roomsForDate,
  slotsForDate,
} from "@/lib/schedule";
import { indexCells } from "@/lib/cellIndex";
import { DayPanel } from "./DayPanel";
import { nodeToPng } from "./Capture";

export function MonthCapture({
  dates,
  monthLabel,
  settings,
  pairings,
  cells,
  memos,
  dayConfigs,
}: {
  dates: string[];
  monthLabel: string;
  settings: Settings;
  pairings: Pairing[];
  cells: Cell[];
  memos: DayMemo[];
  dayConfigs: DayConfig[];
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const runRef = useRef(false);

  useEffect(() => {
    if (!armed || runRef.current) return;
    runRef.current = true;
    (async () => {
      setBusy(true);
      try {
        await new Promise((r) => setTimeout(r, 250)); // let the panels paint
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        for (let i = 0; i < dates.length; i++) {
          const blob = await nodeToPng(`mcap-${dates[i]}`, 2);
          if (blob) zip.file(`${dates[i]}.png`, blob);
          setProgress(Math.round(((i + 1) / dates.length) * 100));
        }
        const out = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(out);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${monthLabel}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } finally {
        setBusy(false);
        setArmed(false);
        runRef.current = false;
        setProgress(0);
      }
    })();
  }, [armed, dates, monthLabel]);

  const idx = indexCells(cells);
  const cfg = indexDayConfigs(dayConfigs);

  return (
    <>
      <button
        type="button"
        onClick={() => setArmed(true)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-paper px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:bg-paper-2 disabled:opacity-50"
      >
        {busy ? `생성 중… ${progress}%` : `⤓ 월 전체 저장 (zip)`}
      </button>

      {armed && (
        <div
          aria-hidden
          className="pointer-events-none fixed left-[-99999px] top-0 w-[920px]"
        >
          {dates.map((d) => {
            const dd = parseIso(d);
            return (
              <DayPanel
                key={d}
                captureId={`mcap-${d}`}
                date={d}
                rooms={roomsForDate(dd, settings, cfg.get(d))}
                slots={slotsForDate(dd, settings, cfg.get(d))}
                pairings={pairings}
                cellIndex={idx}
                memos={memos}
                size="lg"
                memoMode="read"
              />
            );
          })}
        </div>
      )}
    </>
  );
}
