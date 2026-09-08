import { getMonthData, getSettings } from "@/lib/data";
import { isInMonth, iso, weeksOfMonth } from "@/lib/schedule";
import { PageHeader, StepNav } from "@/components/ui";
import { StatsView } from "@/components/StatsView";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const base = await getSettings();
  const y = Number(sp.y) || base.year;
  const m = Number(sp.m) || base.month;

  const data = await getMonthData(y, m);
  // clip every week to the selected month — weeks spill into neighbouring months
  const weeks = weeksOfMonth(y, m, data.settings.week_start).map((w) => ({
    index: w.index,
    key: w.key,
    days: w.days.filter((d) => isInMonth(d, y, m)).map(iso),
    label: `${w.start.getMonth() + 1}.${w.start.getDate()}–${w.end.getMonth() + 1}.${w.end.getDate()}`,
  }));

  const total = y * 12 + (m - 1);
  const prev = { y: Math.floor((total - 1) / 12), m: ((total - 1) % 12) + 1 };
  const next = { y: Math.floor((total + 1) / 12), m: ((total + 1) % 12) + 1 };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={`${data.settings.school_name} · 통계`}
        title={`${y}년 ${m}월`}
        actions={
          <StepNav
            prev={`/stats?y=${prev.y}&m=${prev.m}`}
            next={`/stats?y=${next.y}&m=${next.m}`}
            label={`${y}. ${String(m).padStart(2, "0")}`}
          />
        }
      />

      <StatsView
        settings={data.settings}
        pairings={data.pairings}
        cells={data.cells}
        dayConfigs={data.dayConfigs}
        weeks={weeks}
      />
    </div>
  );
}
