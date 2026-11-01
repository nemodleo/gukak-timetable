import Link from "next/link";
import { getMonthData, getSettings } from "@/lib/data";
import { authConfigured, getRole, isEditorRole } from "@/lib/auth";
import { isInMonth, iso, monthLabel, todayYM, weeksOfMonth } from "@/lib/schedule";
import { PageHeader, StepNav } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";
import { StatsView } from "@/components/StatsView";
import { ArrowKeyNav } from "@/components/ArrowKeyNav";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const role = await getRole();
  if (!role) return <LoginGate configured={authConfigured()} />;
  const base = await getSettings();
  const today = todayYM();
  const y = Number(sp.y) || today.year;
  const m = Number(sp.m) || today.month;

  const total = y * 12 + (m - 1);
  const prev = { y: Math.floor((total - 1) / 12), m: ((total - 1) % 12) + 1 };
  const next = { y: Math.floor((total + 1) / 12), m: ((total + 1) % 12) + 1 };
  const prevHref = `/stats?y=${prev.y}&m=${prev.m}`;
  const nextHref = `/stats?y=${next.y}&m=${next.m}`;

  // viewers (학생·학부모) see the timetable only, not the target-hour stats
  const data = isEditorRole(role) ? await getMonthData(y, m) : null;
  // clip every week to the selected month — weeks spill into neighbouring months
  const weeks =
    data &&
    weeksOfMonth(y, m, data.settings.week_start).map((w) => ({
      index: w.index,
      key: w.key,
      days: w.days.filter((d) => isInMonth(d, y, m)).map(iso),
      label: `${w.start.getMonth() + 1}.${w.start.getDate()}–${w.end.getMonth() + 1}.${w.end.getDate()}`,
    }));

  return (
    <div className="space-y-6">
      <ArrowKeyNav prev={prevHref} next={nextHref} />
      <PageHeader
        eyebrow={`${base.school_name} · 통계`}
        title={monthLabel(y, m)}
        actions={<StepNav prev={prevHref} next={nextHref} />}
      />

      {data && weeks ? (
        <StatsView
          settings={data.settings}
          pairings={data.pairings}
          cells={data.cells}
          dayConfigs={data.dayConfigs}
          weeks={weeks}
        />
      ) : (
        <p className="rounded-lg border bg-paper px-4 py-3 text-[13px] text-ink-3">
          통계는 강사·관리자만 볼 수 있습니다. 열람 계정으로는 시간표만 볼 수 있습니다.{" "}
          <Link href="/" className="text-clay underline underline-offset-4">
            월간 시간표로 돌아가기
          </Link>
        </p>
      )}
    </div>
  );
}
