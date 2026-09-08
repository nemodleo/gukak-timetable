import Link from "next/link";
import { getMonthData, getSettings } from "@/lib/data";
import {
  indexDayConfigs,
  iso,
  isInMonth,
  monthLabel,
  weeksOfMonth,
} from "@/lib/schedule";
import { actualVsTarget } from "@/lib/stats";
import { MonthCalendar } from "@/components/MonthCalendar";
import { MonthCapture } from "@/components/MonthCapture";
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
  // stats count THIS month's days only — weeks spill into neighbouring months
  const inMonthDates = weeks
    .flatMap((w) => w.days)
    .filter((d) => isInMonth(d, y, m))
    .map(iso);
  const dateSet = new Set(inMonthDates);
  const cfgMap = indexDayConfigs(data.dayConfigs);
  const avt = actualVsTarget(data.pairings, data.cells, data.settings, dateSet, cfgMap);
  const anyCells = data.cells.some((c) => dateSet.has(c.date));
  // 목표시수와 차이 나는(초과·미달) 배정 전부 — |차이| 큰 순
  const mismatched = avt
    .filter((a) => a.status === "over" || a.status === "under")
    .sort(
      (a, b) =>
        Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0) ||
        (b.diff ?? -99) - (a.diff ?? -99),
    );

  const prev = shiftMonth(y, m, -1);
  const next = shiftMonth(y, m, 1);

  return (
    <div className="space-y-7">
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
        <SectionTitle sub="주를 클릭하면 주간 시간표, 날짜를 클릭하면 일별 시간표로 이동합니다. 막대는 포화도(수업 채운 시간 ÷ 강사가 입력할 수 있는 시간).">
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

      <section>
        <SectionTitle
          sub={`목표시수와 차이 나는 배정 ${mismatched.length}건 · 전체 명단은 통계에서`}
          right={
            <Link
              href="/stats"
              className="text-[13px] text-clay underline-offset-4 hover:underline"
            >
              전체 통계 →
            </Link>
          }
        >
          수업 차이
        </SectionTitle>
        {mismatched.length === 0 ? (
          <p className="rounded-lg border bg-paper px-4 py-3 text-[13px] text-ink-3">
            {anyCells
              ? "모든 배정이 목표시수와 일치합니다."
              : "아직 배정이 없습니다."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-paper-2 text-[11px] text-ink-3">
                <tr>
                  <th className="px-3 py-2 font-semibold">학생 (교사)</th>
                  <th className="px-3 py-2 text-right font-semibold">실배정</th>
                  <th className="px-3 py-2 text-right font-semibold">목표</th>
                  <th className="px-3 py-2 text-right font-semibold">차이</th>
                </tr>
              </thead>
              <tbody>
                {mismatched.map((a) => (
                  <tr key={a.pairing.id} className="border-t">
                    <td className="px-3 py-1.5">{a.pairing.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{a.actual}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-ink-3">
                      {a.target ?? "—"}
                    </td>
                    <td
                      className={
                        "px-3 py-1.5 text-right tabular-nums font-semibold " +
                        (a.status === "over" ? "text-over" : "text-warn")
                      }
                    >
                      {a.diff != null && a.diff > 0 ? `+${a.diff}` : a.diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
