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
  weekRangeLabel,
  type Week,
} from "@/lib/schedule";
import { durationH } from "@/lib/time";
import { DOW_KO, dowOrder } from "@/lib/stats";

export function MonthCalendar({
  weeks,
  year,
  month,
  cells,
  settings,
  dayConfigs = [],
  currentKey,
}: {
  weeks: Week[];
  year: number;
  month: number;
  cells: Cell[];
  settings: Settings;
  dayConfigs?: DayConfig[];
  currentKey?: string;
}) {
  const cfg = indexDayConfigs(dayConfigs);
  const order = dowOrder(settings.week_start);

  // 포화도: 수업(pairing) 채운 시간 ÷ 강사가 입력할 수 있는 시간
  //         (관리자가 설정한 강의실·시간블록 범위 − 비수업 시간)
  const usedH = new Map<string, number>();
  const blockedH = new Map<string, number>();
  for (const c of cells) {
    const h = slotHours(parseIso(c.date), c.slot_index, settings, cfg.get(c.date));
    if (c.kind === "pairing")
      usedH.set(c.date, (usedH.get(c.date) ?? 0) + h);
    else if (c.kind === "block")
      blockedH.set(c.date, (blockedH.get(c.date) ?? 0) + h);
  }

  return (
    <div className="overflow-x-auto scroll-thin rounded-lg border">
      <div className="min-w-[560px]">
      <div
        className="grid border-b bg-paper-2 text-[11px] font-semibold text-ink-3"
        style={{ gridTemplateColumns: `104px repeat(7, minmax(0, 1fr))` }}
      >
        <div className="px-3 py-2">주</div>
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
              active && "bg-[var(--color-current-week)]",
            )}
            style={{ gridTemplateColumns: `104px repeat(7, minmax(0, 1fr))` }}
          >
            <Link
              href={`/week/${w.key}`}
              className="flex flex-col justify-center gap-0.5 border-r px-3 py-2.5 transition-colors hover:bg-paper-2"
            >
              <span className="text-[12px] font-semibold text-ink">
                {w.index}주
              </span>
              <span className="text-[10.5px] tabular-nums text-ink-3">
                {weekRangeLabel(w)}
              </span>
            </Link>

            {w.days.map((d) => {
              const inMonth = isInMonth(d, year, month);
              const dc = cfg.get(iso(d));
              const perDayH = slotsForDate(d, settings, dc).reduce(
                (a, s) => a + durationH(s.start, s.end),
                0,
              );
              const capacity = perDayH * roomsForDate(d, settings, dc).length;
              // 강사가 입력할 수 있는 시간 = 설정된 범위 − 비수업 시간
              const available = Math.max(0, capacity - (blockedH.get(iso(d)) ?? 0));
              const used = usedH.get(iso(d)) ?? 0;
              const pct = available > 0 ? used / available : 0;
              return (
                <Link
                  key={iso(d)}
                  href={`/day/${iso(d)}`}
                  style={
                    inMonth
                      ? undefined
                      : {
                          backgroundImage:
                            "repeating-linear-gradient(135deg, transparent 0 6px, var(--color-paper-2) 6px 7px)",
                        }
                  }
                  className={clsx(
                    "group flex min-h-[68px] flex-col gap-1 border-r px-2 py-1.5 transition-colors last:border-r-0 hover:bg-paper-2",
                    !inMonth && "text-ink-3",
                  )}
                >
                  <span
                    className={clsx(
                      "text-[12px] tabular-nums",
                      inMonth ? "font-medium text-ink-2" : "text-ink-3",
                    )}
                  >
                    {fmtDayShort(d)}
                  </span>
                  {used > 0 && (
                    <span className="mt-auto flex items-center gap-1">
                      <span className="h-1 w-full overflow-hidden rounded-full bg-line">
                        <span
                          className="block h-full rounded-full bg-clay-soft"
                          style={{ width: `${Math.min(100, pct * 100)}%` }}
                        />
                      </span>
                      <span className="shrink-0 text-[9px] tabular-nums text-ink-3">
                        {used}h
                      </span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
      </div>
    </div>
  );
}
