"use client";

import { useEffect, useRef, useState } from "react";
import type { Cell, DayMemo, Pairing, SlotDef } from "@/lib/types";
import { indexCells } from "@/lib/cellIndex";
import { DayPanel } from "./DayPanel";
import { nodeToPng } from "./Capture";

/** fixed capture width — every day PNG comes out exactly this wide (× scale) */
const PANEL_W = 920;

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Capture one or more days by rendering fresh read-only <DayPanel>s off-screen
 *  and rasterising those — never the live editable grid. The editor grid has
 *  <input> fields (memo), interactive chrome and, in some browsers, injected
 *  overlays (password managers etc.) that leak into a screenshot as stray white
 *  boxes. A clean off-screen panel has none of that. Mirrors <MonthCapture>. */
export function DayCapture({
  days,
  zipName,
  label,
  pairings,
  cells,
  memos,
  scale = 2.5,
}: {
  days: { date: string; rooms: string[]; slots: SlotDef[] }[];
  zipName: string;
  label?: string;
  pairings: Pairing[];
  cells: Cell[];
  memos: DayMemo[];
  scale?: number;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const runRef = useRef(false);
  const multi = days.length > 1;

  useEffect(() => {
    if (!armed || runRef.current) return;
    runRef.current = true;
    (async () => {
      setBusy(true);
      try {
        // let the off-screen panels fully lay out before rasterising
        await new Promise((r) => setTimeout(r, 500));
        if (!multi) {
          const blob = await nodeToPng(`dcap-${days[0].date}`, scale, PANEL_W);
          if (blob) save(blob, `${days[0].date}.png`);
        } else {
          const JSZip = (await import("jszip")).default;
          const zip = new JSZip();
          for (let i = 0; i < days.length; i++) {
            const blob = await nodeToPng(`dcap-${days[i].date}`, scale, PANEL_W);
            if (blob) zip.file(`${days[i].date}.png`, blob);
            setProgress(Math.round(((i + 1) / days.length) * 100));
          }
          const out = await zip.generateAsync({ type: "blob" });
          save(out, zipName);
        }
      } finally {
        setBusy(false);
        setArmed(false);
        runRef.current = false;
        setProgress(0);
      }
    })();
  }, [armed, days, zipName, scale, multi]);

  const idx = indexCells(cells);

  return (
    <>
      <button
        type="button"
        data-no-capture
        onClick={() => setArmed(true)}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-paper px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:bg-paper-2 disabled:opacity-50"
      >
        {busy
          ? `생성 중…${multi ? ` ${progress}%` : ""}`
          : `⤓ ${label ?? (multi ? "주 전체 저장 (zip)" : "이미지 저장")}`}
      </button>

      {armed && (
        <div
          aria-hidden
          className="pointer-events-none fixed left-[-99999px] top-0"
        >
          {days.map((d) => (
            <div key={d.date} style={{ width: PANEL_W }}>
              <DayPanel
                captureId={`dcap-${d.date}`}
                date={d.date}
                rooms={d.rooms}
                slots={d.slots}
                pairings={pairings}
                cellIndex={idx}
                memos={memos}
                size="lg"
                memoMode="read"
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
