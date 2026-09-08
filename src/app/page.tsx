import Link from "next/link";
import { getMonthData, getSettings } from "@/lib/data";
import { iso, isInMonth, monthLabel, weeksOfMonth } from "@/lib/schedule";
import { MonthCalendar } from "@/components/MonthCalendar";
import { MonthCapture } from "@/components/MonthCapture";
import { ArrowKeyNav } from "@/components/ArrowKeyNav";
import { PageHeader, SectionTitle, StepNav } from "@/components/ui";
import { ConfigNotice } from "@/components/ConfigNotice";
import { hasSupabase } from "@/lib/supabaseServer";

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

  return (
    <div className="space-y-7">
      <ArrowKeyNav
        prev={`/?y=${prev.y}&m=${prev.m}`}
        next={`/?y=${next.y}&m=${next.m}`}
      />
      <PageHeader
        eyebrow={data.settings.school_name}
        title={`${monthLabel(y, m)} 시간표`}
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
            <StepNav
              prev={`/?y=${prev.y}&m=${prev.m}`}
              next={`/?y=${next.y}&m=${next.m}`}
              label={`${y}. ${String(m).padStart(2, "0")}`}
            />
          </>
        }
      />

      {!hasSupabase() && <ConfigNotice />}

      <section>
        <SectionTitle sub="주를 클릭하면 주간 시간표, 날짜를 클릭하면 일별 시간표로 이동합니다(← → 키로 월 이동). 막대는 포화도(강사가 입력할 수 있는 시간 대비), 숫자는 수업 개수, ✕는 넣을 수 있는 시간이 없는 날.">
          월간 달력
        </SectionTitle>
        <MonthCalendar
          weeks={weeks}
          year={y}
          month={m}
          cells={data.cells}
          settings={data.settings}
          dayConfigs={data.dayConfigs}
        />
      </section>

      {!anyCells && (
        <p className="text-[13px] text-ink-3">
          아직 배정된 시간표가 없습니다.{" "}
          <Link className="text-clay underline" href="/admin">
            관리자
          </Link>
          에서 엑셀 데이터를 가져오세요.
        </p>
      )}
    </div>
  );
}
