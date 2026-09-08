import { getMonthData, getSettings } from "@/lib/data";
import { iso, isInMonth, monthLabel, weeksOfMonth } from "@/lib/schedule";
import { MonthCalendar } from "@/components/MonthCalendar";
import { MonthCapture } from "@/components/MonthCapture";
import { ArrowKeyNav } from "@/components/ArrowKeyNav";
import { PageHeader, StepNav } from "@/components/ui";

export const dynamic = "force-dynamic";

function shiftMonth(y: number, m: number, d: number) {
  const total = y * 12 + (m - 1) + d;
  return { y: Math.floor(total / 12), m: (total % 12) + 1 };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const base = await getSettings();
  const y = Number(sp.y) || base.year;
  const m = Number(sp.m) || base.month;

  const data = await getMonthData(y, m);
  const weeks = weeksOfMonth(y, m, data.settings.week_start);
  const inMonthDates = weeks
    .flatMap((w) => w.days)
    .filter((d) => isInMonth(d, y, m))
    .map(iso);
  const dateSet = new Set(inMonthDates);
  const anyCells = data.cells.some((c) => dateSet.has(c.date));

  const prev = shiftMonth(y, m, -1);
  const next = shiftMonth(y, m, 1);
  const prevHref = `/?y=${prev.y}&m=${prev.m}`;
  const nextHref = `/?y=${next.y}&m=${next.m}`;

  return (
    <div className="space-y-6">
      <ArrowKeyNav prev={prevHref} next={nextHref} />
      <PageHeader
        eyebrow={`${data.settings.school_name} · 월간 시간표`}
        title={monthLabel(y, m)}
        actions={
          <>
            <MonthCapture
              dates={inMonthDates}
              monthLabel={`${y}-${String(m).padStart(2, "0")}`}
              settings={data.settings}
              pairings={data.pairings}
              cells={data.cells}
              memos={data.memos}
              dayConfigs={data.dayConfigs}
            />
            <StepNav prev={prevHref} next={nextHref} />
          </>
        }
      />

      <MonthCalendar
        weeks={weeks}
        year={y}
        month={m}
        cells={data.cells}
        settings={data.settings}
        dayConfigs={data.dayConfigs}
      />

      {!anyCells && (
        <p className="text-[13px] text-ink-3">
          아직 배정된 시간표가 없습니다. 관리자에게 문의하세요.
        </p>
      )}
    </div>
  );
}
