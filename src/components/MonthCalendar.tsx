"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { Cell, DayConfig, Settings } from "@/lib/types";
import {
  fmtDayShort,
  iso,
  indexDayConfigs,
  isInMonth,
  parseIso,
  roomsForDate,
  slotHours,
  slotsForDate,
  type Week,
} from "@/lib/schedule";
import { durationH } from "@/lib/time";
import { DOW_KO, dowOrder } from "@/lib/stats";
import { LockIcon } from "./ui";

type Role = "admin" | "instructor" | null;

export function MonthCalendar({
  weeks,
  year,
  month,
  cells,
  settings,
  dayConfigs = [],
  approvedDates = [],
  role = null,
  currentKey,
}: {
  weeks: Week[];
  year: number;
  month: number;
  cells: Cell[];
  settings: Settings;
  dayConfigs?: DayConfig[];
  /** 관리자가 승인(오픈)한 날짜 — 없는 날짜는 기본 잠금 */
  approvedDates?: string[];
  role?: Role;
  currentKey?: string;
}) {
  const isAdmin = role === "admin";
  const cfg = indexDayConfigs(dayConfigs);
  const order = dowOrder(settings.week_start);

  const [approved, setApproved] = useState<Set<string>>(() => new Set(approvedDates));
  const [paintMode, setPaintMode] = useState(false);
  const [preview, setPreview] = useState<Set<string>>(new Set());
  const drag = useRef<{ value: "approve" | "lock"; set: Set<string> } | null>(null);

  useEffect(() => {
    if (!paintMode) return;
    const up = async () => {
      const d = drag.current;
      drag.current = null;
      setPreview(new Set());
      if (!d || !d.set.size) return;
      const dates = [...d.set];
      const nextApproved = d.value === "approve";
      const res = await fetch("/api/day-approvals", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dates, approved: nextApproved }),
      });
      if (!res.ok) return;
      setApproved((prev) => {
        const n = new Set(prev);
        for (const date of dates) {
          if (nextApproved) n.add(date);
          else n.delete(date);
        }
        return n;
      });
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [paintMode]);

  const inMonthDates = weeks
    .flatMap((w) => w.days)
    .filter((d) => isInMonth(d, year, month))
    .map(iso);
  const monthAllApproved =
    inMonthDates.length > 0 && inMonthDates.every((date) => approved.has(date));

  async function toggleWholeMonth() {
    const nextApproved = !monthAllApproved;
    const res = await fetch("/api/day-approvals", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dates: inMonthDates, approved: nextApproved }),
    });
    if (!res.ok) return;
    setApproved((prev) => {
      const n = new Set(prev);
      for (const date of inMonthDates) {
        if (nextApproved) n.add(date);
        else n.delete(date);
      }
      return n;
    });
  }

  const paintStart = (date: string) => {
    const value: "approve" | "lock" = approved.has(date) ? "lock" : "approve";
    drag.current = { value, set: new Set([date]) };
    setPreview(new Set([date]));
  };
  const paintEnter = (date: string) => {
    if (!drag.current) return;
    drag.current.set.add(date);
    setPreview(new Set(drag.current.set));
  };

  // 포화도: 수업(pairing) 채운 시간 ÷ 강사가 입력할 수 있는 시간
  //         (관리자가 설정한 강의실·시간블록 범위 − 비수업 시간)
  const usedH = new Map<string, number>();
  const blockedH = new Map<string, number>();
  const usedCount = new Map<string, number>();
  for (const c of cells) {
    const h = slotHours(parseIso(c.date), c.slot_index, settings, cfg.get(c.date));
    if (c.kind === "pairing") {
      usedH.set(c.date, (usedH.get(c.date) ?? 0) + h);
      usedCount.set(c.date, (usedCount.get(c.date) ?? 0) + 1);
    } else if (c.kind === "block")
      blockedH.set(c.date, (blockedH.get(c.date) ?? 0) + h);
  }

  // 좁으면 "주" 열을 줄이다가(88 → 52 → 0) 없앤다. 요일 열은 최소 폭 유지.
  const gridCols =
    "[grid-template-columns:repeat(7,minmax(0,1fr))] " +
    "sm:[grid-template-columns:52px_repeat(7,minmax(0,1fr))] " +
    "lg:[grid-template-columns:88px_repeat(7,minmax(0,1fr))]";

  return (
    <div className="space-y-2">
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2" data-no-capture>
          <button
            type="button"
            onClick={() => setPaintMode((p) => !p)}
            className={clsx(
              "rounded-full border px-3.5 py-1.5 text-[12px] transition-colors",
              paintMode
                ? "border-clay bg-clay text-paper"
                : "border-line-strong text-ink-2 hover:bg-paper-2",
            )}
          >
            {paintMode ? "승인 지정 중 — 드래그하세요" : "승인 지정"}
          </button>
          <button
            type="button"
            onClick={toggleWholeMonth}
            title={
              monthAllApproved
                ? "이 달 전체를 다시 잠급니다"
                : "이 달의 모든 날짜를 한 번에 승인합니다"
            }
            className="rounded-full border border-line-strong px-3.5 py-1.5 text-[12px] text-ink-2 transition-colors hover:bg-paper-2"
          >
            {monthAllApproved ? "이번 달 전체 잠금" : "이번 달 전체 승인"}
          </button>
        </div>
      )}

      <div
        className="overflow-x-auto scroll-thin rounded-lg border"
        style={paintMode ? { userSelect: "none", cursor: "crosshair" } : undefined}
      >
        <div className="min-w-[480px]">
        <div
          className={clsx(
            "grid border-b bg-paper-2 text-[11px] font-semibold text-ink-3",
            gridCols,
          )}
        >
          <div className="hidden px-2 py-2 sm:block">주</div>
          {order.map((g) => (
            <div
              key={g}
              className={clsx(
                "px-2 py-2 text-center",
                (g === 0 || g === 6) && "text-clay",
              )}
            >
              {DOW_KO[g]}
            </div>
          ))}
        </div>

        {weeks.map((w) => {
          const active = w.key === currentKey;
          return (
            <div
              key={w.key}
              className={clsx(
                "grid border-b last:border-b-0",
                gridCols,
                active && "bg-[var(--color-current-week)]",
              )}
            >
              <Link
                href={`/week/${w.key}`}
                className="hidden items-center overflow-hidden whitespace-nowrap border-r px-2 py-2.5 text-[12px] font-semibold text-ink transition-colors hover:bg-paper-2 sm:flex sm:px-3"
              >
                {w.index}주
              </Link>

              {w.days.map((d) => {
                const date = iso(d);
                const inMonth = isInMonth(d, year, month);
                const dc = cfg.get(date);
                const perDayH = slotsForDate(d, settings, dc).reduce(
                  (a, s) => a + durationH(s.start, s.end),
                  0,
                );
                const capacity = perDayH * roomsForDate(d, settings, dc).length;
                // 강사가 입력할 수 있는 시간 = 설정된 범위 − 비수업 시간
                const available = Math.max(0, capacity - (blockedH.get(date) ?? 0));
                const used = usedH.get(date) ?? 0;
                const count = usedCount.get(date) ?? 0;
                const pct = available > 0 ? used / available : 0;
                const locked = !approved.has(date);
                const showLockBadge = role != null && locked;

                const inMonthBg = !inMonth
                  ? {
                      backgroundImage:
                        "repeating-linear-gradient(135deg, transparent 0 6px, var(--color-paper-2) 6px 7px)",
                    }
                  : undefined;

                const content = (
                  <>
                    <span
                      className={clsx(
                        "text-[12px] tabular-nums",
                        inMonth ? "font-medium text-ink-2" : "text-ink-3",
                      )}
                    >
                      {fmtDayShort(d)}
                    </span>
                    {showLockBadge && (
                      <LockIcon
                        className="absolute right-1 top-1 h-3 w-3 text-ink-3 opacity-70"
                        title="관리자 승인 대기(강사 입력 잠금)"
                      />
                    )}
                    {available <= 0 ? (
                      <span
                        className="mt-auto text-[11px] font-medium text-ink-3"
                        title="수업을 넣을 수 있는 시간이 없습니다"
                      >
                        ✕
                      </span>
                    ) : (
                      <span className="mt-auto flex items-center gap-1">
                        <span className="h-1 w-full overflow-hidden rounded-full bg-line">
                          <span
                            className="block h-full rounded-full bg-clay-soft"
                            style={{ width: `${Math.min(100, pct * 100)}%` }}
                          />
                        </span>
                        <span className="shrink-0 text-[9px] tabular-nums text-ink-3">
                          {count}개
                        </span>
                      </span>
                    )}
                  </>
                );

                if (paintMode) {
                  return (
                    <div
                      key={date}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        paintStart(date);
                      }}
                      onMouseEnter={() => paintEnter(date)}
                      style={inMonthBg}
                      className={clsx(
                        "group relative flex min-h-[68px] flex-col gap-1 border-r px-2 py-1.5 last:border-r-0",
                        !inMonth && "text-ink-3",
                        preview.has(date) &&
                          "outline outline-2 -outline-offset-2 outline-clay",
                      )}
                    >
                      {content}
                    </div>
                  );
                }
                return (
                  <Link
                    key={date}
                    href={`/day/${date}`}
                    style={inMonthBg}
                    className={clsx(
                      "group relative flex min-h-[68px] flex-col gap-1 border-r px-2 py-1.5 transition-colors last:border-r-0 hover:bg-paper-2",
                      !inMonth && "text-ink-3",
                    )}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
