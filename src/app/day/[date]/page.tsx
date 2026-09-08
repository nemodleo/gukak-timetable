import Link from "next/link";
import {
  getCells,
  getDayConfigs,
  getMemos,
  getPairingsForRange,
  getSettings,
} from "@/lib/data";
import { getRole } from "@/lib/auth";
import { addDays, fmtDayHeader, iso, parseIso, startOfWeekKey } from "@/lib/schedule";
import { ScheduleBoard } from "@/components/ScheduleBoard";
import { DayKeyNav } from "@/components/DayKeyNav";
import { Legend, PageHeader, StepNav } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const d = parseIso(date);

  const [settings, pairings, cells, memos, dayConfigs, role] = await Promise.all([
    getSettings(),
    getPairingsForRange(date, date),
    getCells(date, date),
    getMemos(date, date),
    getDayConfigs(date, date),
    getRole(),
  ]);

  const prev = iso(addDays(d, -1));
  const next = iso(addDays(d, 1));
  const weekKey = startOfWeekKey(d, settings.week_start);

  return (
    <div className="space-y-6">
      <DayKeyNav prev={prev} next={next} />
      <PageHeader
        eyebrow={
          <>
            {settings.school_name} ·{" "}
            <Link href={`/week/${weekKey}`} className="hover:underline">
              주간 보기
            </Link>
          </>
        }
        title={fmtDayHeader(d)}
        actions={
          <>
            <Legend className="mr-1 hidden sm:flex" />
            <StepNav prev={`/day/${prev}`} next={`/day/${next}`} />
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
        initialWeekKey={weekKey}
        dayOnly={date}
      />
    </div>
  );
}
