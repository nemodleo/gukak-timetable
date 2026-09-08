import Link from "next/link";
import { getMonthData, getSettings } from "@/lib/data";
import { getRole } from "@/lib/auth";
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
  const role = await getRole();
  const base = await getSettings();
  const y = Number(sp.y) || base.year;
  const m = Number(sp.m) || base.month;

  if (!role) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={`${base.school_name} · 통계`} title={`${y}년 ${m}월`} />
        <p className="rounded-lg border bg-paper px-4 py-3 text-[13px] text-ink-3">
          통계는 로그인한 강사·관리자만 볼 수 있습니다. 오른쪽 위에서{" "}
          <span className="font-medium text-ink-2">강사</span> 또는{" "}
          <span className="font-medium text-ink-2">관리자</span>로 로그인하세요.{" "}
          <Link href="/" className="text-clay underline underline-offset-4">
            월간 시간표로 돌아가기
          </Link>
        </p>
      </div>
    );
  }

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
