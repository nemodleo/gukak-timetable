import Link from "next/link";
import {
  getCells,
  getDayConfigs,
  getMemos,
  getPairingsForRange,
  getSettings,
} from "@/lib/data";
import { getRole } from "@/lib/auth";
import { addDays, iso, weekFromKey, weekRangeLabel } from "@/lib/schedule";
import { ScheduleBoard } from "@/components/ScheduleBoard";
import { Legend, PageHeader, StepNav } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WeekPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const week = weekFromKey(key);
  const from = iso(week.start);
  const to = iso(week.end);

  const [settings, pairings, cells, memos, dayConfigs, role] = await Promise.all([
    getSettings(),
    getPairingsForRange(from, to),
    getCells(from, to),
    getMemos(from, to),
    getDayConfigs(from, to),
    getRole(),
  ]);

  const prevKey = iso(addDays(week.start, -7));
  const nextKey = iso(addDays(week.start, 7));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${settings.school_name} · 주간 시간표`}
        title={weekRangeLabel(week)}
        actions={
          <>
            <Legend className="mr-1 hidden lg:flex" />
            <StepNav prev={`/week/${prevKey}`} next={`/week/${nextKey}`} />
          </>
        }
      />

      <ScheduleBoard
        role={role}
        settings={settings}
        pairings={pairings}
        initialCells={cells}
        initialMemos={memos}
        initialConfigs={dayConfigs}
        year={settings.year}
        month={settings.month}
        initialWeekKey={key}
      />

      <div className="flex flex-wrap gap-2 border-t border-line pt-4" data-no-capture>
        <span className="label-eyebrow mr-1 self-center">일별 보기</span>
        {week.days.map((d) => (
          <Link
            key={iso(d)}
            href={`/day/${iso(d)}`}
            className="rounded-full border px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:bg-paper-2"
          >
            {iso(d).slice(5)}
          </Link>
        ))}
      </div>
    </div>
  );
}
