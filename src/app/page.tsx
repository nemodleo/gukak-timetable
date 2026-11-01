import { getMonthData } from "@/lib/data";
import { authConfigured, getRole } from "@/lib/auth";
import { iso, isInMonth, monthLabel, todayYM, weeksOfMonth } from "@/lib/schedule";
import { LoginGate } from "@/components/LoginGate";
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
  // no ?y&m → the month we're in right now (KST), not the admin's base month
  const today = todayYM();
  const y = Number(sp.y) || today.year;
  const m = Number(sp.m) || today.month;

  // student names are on the calendar — nothing is rendered for anonymous visitors
  const role = await getRole();
  if (!role) return <LoginGate configured={authConfigured()} />;
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
        approvedDates={data.approvedDates}
        role={role}
      />

      {!anyCells && (
        <p className="text-[13px] text-ink-3">
          아직 배정된 시간표가 없습니다. 관리자에게 문의하세요.
        </p>
      )}
    </div>
  );
}
