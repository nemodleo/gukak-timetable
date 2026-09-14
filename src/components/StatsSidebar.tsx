"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Cell, DayConfig, Pairing, Settings } from "@/lib/types";
import { actualVsTarget, type ActualVsTarget } from "@/lib/stats";
import { indexDayConfigs, isInMonth, iso, weeksOfMonth, ymKey } from "@/lib/schedule";

/** compact "목표 차이" list next to the schedule editor — for 강사/관리자 only
 *  (StatsSidebar is only ever mounted when role != null; see ScheduleBoard). */
export function StatsSidebar({
  year,
  month,
  settings,
}: {
  year: number;
  month: number;
  settings: Settings;
}) {
  const [rows, setRows] = useState<ActualVsTarget[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const resetTimer = setTimeout(() => {
      if (cancelled) return;
      setRows(null);
      setFailed(false);
    }, 0);
    (async () => {
      try {
        const weeks = weeksOfMonth(year, month, settings.week_start);
        const from = iso(weeks[0].start);
        const to = iso(weeks[weeks.length - 1].end);
        const ym = ymKey(year, month);
        const [pRes, cRes, dcRes] = await Promise.all([
          fetch(`/api/pairings?ym=${ym}`),
          fetch(`/api/schedule?from=${from}&to=${to}`),
          fetch(`/api/day-config?from=${from}&to=${to}`),
        ]);
        if (!pRes.ok || !cRes.ok) throw new Error("fetch failed");
        const pairings: Pairing[] = await pRes.json();
        const cells: Cell[] = await cRes.json();
        const dayConfigs: DayConfig[] = dcRes.ok ? await dcRes.json() : [];
        if (cancelled) return;
        const dateSet = new Set(
          weeks
            .flatMap((w) => w.days)
            .filter((d) => isInMonth(d, year, month))
            .map(iso),
        );
        const cfgMap = indexDayConfigs(dayConfigs);
        const avt = actualVsTarget(pairings, cells, settings, dateSet, cfgMap).sort(
          (a, b) => {
            const rank = (s: string) =>
              s === "over" ? 0 : s === "under" ? 1 : s === "exact" ? 2 : 3;
            return (
              rank(a.status) - rank(b.status) ||
              Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0)
            );
          },
        );
        setRows(avt);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(resetTimer);
    };
  }, [year, month, settings]);

  return (
    <div
      className="rounded-lg border bg-paper p-3"
      data-no-capture
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-serif text-[14px] font-medium text-ink">목표 차이</h2>
        <Link
          href={`/stats?y=${year}&m=${month}`}
          className="shrink-0 text-[11px] text-clay hover:underline"
        >
          전체 통계 →
        </Link>
      </div>

      {failed && (
        <p className="text-[12px] text-ink-3">불러오지 못했습니다.</p>
      )}
      {!rows && !failed && (
        <p className="text-[12px] text-ink-3">불러오는 중…</p>
      )}
      {rows && rows.length === 0 && (
        <p className="text-[12px] text-ink-3">이 달에 배정이 없습니다.</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="max-h-[65vh] space-y-1 overflow-y-auto scroll-thin pr-1">
          {rows.map((a) => (
            <li
              key={a.pairing.id}
              className="flex items-center justify-between gap-2 border-b border-line py-1 text-[12.5px] last:border-b-0"
            >
              <span className="truncate text-ink-2" title={a.pairing.label}>
                {a.pairing.label}
              </span>
              <span
                className={clsx(
                  "shrink-0 tabular-nums font-medium",
                  a.status === "over"
                    ? "text-over"
                    : a.status === "under"
                      ? "text-warn"
                      : "text-ink-3",
                )}
              >
                {a.status === "exact"
                  ? "0"
                  : a.diff == null
                    ? "—"
                    : a.diff > 0
                      ? `+${a.diff}`
                      : a.diff}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
