"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { Cell, DayConfig, Pairing, Settings } from "@/lib/types";
import { DOW_KO, dowOrder } from "@/lib/stats";
import { actualVsTarget, totals, weekdayMatrix } from "@/lib/stats";
import { indexDayConfigs, parseIso } from "@/lib/schedule";
import { badgeBg, gradeKey } from "@/lib/colors";
import { SectionTitle } from "./ui";

interface WeekLite {
  index: number;
  key: string;
  days: string[];
  label: string;
}

function Bar({
  v,
  max,
  tone,
}: {
  v: number;
  max: number;
  tone?: "clay" | "over" | "under";
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line">
        <span
          className={clsx(
            "block h-full rounded-full",
            tone === "over"
              ? "bg-over"
              : tone === "under"
                ? "bg-warn"
                : "bg-clay-soft",
          )}
          style={{ width: `${max ? Math.min(100, (v / max) * 100) : 0}%` }}
        />
      </span>
      <span className="tabular-nums text-[11px] text-ink-3">{v}</span>
    </span>
  );
}

export function StatsView({
  settings,
  pairings,
  cells,
  dayConfigs = [],
  weeks,
}: {
  settings: Settings;
  pairings: Pairing[];
  cells: Cell[];
  dayConfigs?: DayConfig[];
  weeks: WeekLite[];
}) {
  const cfgMap = useMemo(() => indexDayConfigs(dayConfigs), [dayConfigs]);
  const [weekKey, setWeekKey] = useState<string>("all");
  const [dow, setDow] = useState<string>("all");
  const [grade, setGrade] = useState<string>("all");
  const [teacher, setTeacher] = useState<string>("all");

  const allDates = useMemo(() => weeks.flatMap((w) => w.days), [weeks]);
  const teachers = useMemo(
    () => [...new Set(pairings.map((p) => p.teacher_name).filter(Boolean))].sort(),
    [pairings],
  );

  const scopeDates = useMemo(() => {
    let ds = weekKey === "all" ? allDates : (weeks.find((w) => w.key === weekKey)?.days ?? []);
    if (dow !== "all") {
      const g = Number(dow);
      ds = ds.filter((d) => parseIso(d).getDay() === g);
    }
    return ds;
  }, [weekKey, dow, weeks, allDates]);
  const scopeSet = useMemo(() => new Set(scopeDates), [scopeDates]);

  const filteredPairings = useMemo(
    () =>
      pairings.filter((p) => {
        if (grade !== "all" && gradeKey(p.grade, p.label) !== grade) return false;
        if (teacher !== "all" && p.teacher_name !== teacher) return false;
        return true;
      }),
    [pairings, grade, teacher],
  );
  const fpIds = useMemo(() => new Set(filteredPairings.map((p) => p.id)), [filteredPairings]);
  const scopedCells = useMemo(
    () =>
      cells.filter(
        (c) =>
          scopeSet.has(c.date) &&
          (c.kind !== "pairing" || !c.pairing_id || fpIds.has(c.pairing_id)),
      ),
    [cells, scopeSet, fpIds],
  );

  const t = totals(filteredPairings, scopedCells, settings, scopeDates, cfgMap);
  const avt = actualVsTarget(
    filteredPairings,
    scopedCells,
    settings,
    scopeSet,
    cfgMap,
  ).sort((a, b) => {
    // 초과(+) 내림차순 → 미달(−) 내림차순 → 일치(0) → 목표없음
    const rank = (s: string) =>
      s === "over" ? 0 : s === "under" ? 1 : s === "exact" ? 2 : 3;
    return (
      rank(a.status) - rank(b.status) ||
      Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0)
    );
  });
  const matrix = weekdayMatrix(
    filteredPairings,
    scopedCells,
    settings,
    settings.week_start,
    scopeSet,
    cfgMap,
  ).filter((r) => r.total > 0 || weekKey === "all");

  const orderG = dowOrder(settings.week_start);

  const selCls =
    "rounded-md border border-line-strong bg-paper px-2.5 py-1.5 text-[12.5px] text-ink-2";

  return (
    <div className="space-y-8">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={selCls} value={weekKey} onChange={(e) => setWeekKey(e.target.value)}>
          <option value="all">전체 월</option>
          {weeks.map((w) => (
            <option key={w.key} value={w.key}>
              {w.index}주 ({w.label})
            </option>
          ))}
        </select>
        <select className={selCls} value={dow} onChange={(e) => setDow(e.target.value)}>
          <option value="all">모든 요일</option>
          {orderG.map((g) => (
            <option key={g} value={g}>
              {DOW_KO[g]}요일
            </option>
          ))}
        </select>
        <select className={selCls} value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="all">전체 학년</option>
          <option value="g1">1학년</option>
          <option value="g2">2학년</option>
          <option value="g3">3학년</option>
          <option value="gm">보강·합반</option>
        </select>
        <select className={selCls} value={teacher} onChange={(e) => setTeacher(e.target.value)}>
          <option value="all">전체 교사</option>
          {teachers.map((tn) => (
            <option key={tn} value={tn}>
              {tn}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-ink-3">
          {scopeDates.length}일 · {t.pairingCells + t.textCells}칸
        </span>
      </div>

      {/* actual vs target */}
      <section>
        <SectionTitle>수업 차이</SectionTitle>
        <div className="overflow-x-auto rounded-lg border scroll-thin">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="bg-paper-2 text-[11px] text-ink-3">
              <tr>
                <th className="px-3 py-2 font-semibold">학생 (교사)</th>
                <th className="px-3 py-2 font-semibold">학년</th>
                <th className="px-3 py-2 text-right font-semibold">실배정</th>
                <th className="px-3 py-2 text-right font-semibold">목표</th>
                <th className="px-3 py-2 text-right font-semibold">차이</th>
                <th className="px-3 py-2 font-semibold">진행</th>
              </tr>
            </thead>
            <tbody>
              {avt.map((a) => {
                const gk = gradeKey(a.pairing.grade, a.pairing.label);
                return (
                  <tr key={a.pairing.id} className="border-t">
                    <td className="px-3 py-1.5">{a.pairing.label}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className="rounded px-1.5 py-0.5 text-[10.5px] text-ink"
                        style={{ background: badgeBg[gk] }}
                      >
                        {a.pairing.grade || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{a.actual}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-ink-3">
                      {a.target ?? "—"}
                    </td>
                    <td
                      className={clsx(
                        "px-3 py-1.5 text-right tabular-nums",
                        a.status === "over"
                          ? "font-semibold text-over"
                          : a.status === "under"
                            ? "font-semibold text-warn"
                            : "text-ink-3",
                      )}
                    >
                      {a.status === "exact"
                        ? "0"
                        : a.diff == null
                          ? "—"
                          : a.diff > 0
                            ? `+${a.diff}`
                            : a.diff}
                    </td>
                    <td className="px-3 py-1.5">
                      <Bar
                        v={a.actual}
                        max={Math.max(a.target ?? 0, a.actual, 1)}
                        tone={
                          a.status === "over"
                            ? "over"
                            : a.status === "under"
                              ? "under"
                              : "clay"
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* pairing x weekday matrix */}
      <section>
        <SectionTitle>페어링 × 요일</SectionTitle>
        <div className="overflow-x-auto rounded-lg border scroll-thin">
          <table className="w-full min-w-[560px] text-left text-[12.5px]">
            <thead className="bg-paper-2 text-[11px] text-ink-3">
              <tr>
                <th className="px-3 py-2 font-semibold">학생 (교사)</th>
                {orderG.map((g) => (
                  <th
                    key={g}
                    className={clsx(
                      "px-2 py-2 text-center font-semibold",
                      (g === 0 || g === 6) && "text-clay",
                    )}
                  >
                    {DOW_KO[g]}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">합계</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((r) => (
                <tr key={r.pairing.id} className="border-t">
                  <td className="px-3 py-1.5">{r.pairing.label}</td>
                  {r.byDay.map((h, i) => (
                    <td
                      key={i}
                      className={clsx(
                        "px-2 py-1.5 text-center tabular-nums",
                        h === 0 ? "text-line-strong" : "text-ink",
                      )}
                    >
                      {h || "·"}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                    {r.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
