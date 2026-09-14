"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GradeColors, InactivePattern, Settings, SlotDef } from "@/lib/types";
import {
  DEFAULT_GRADE_COLORS,
  DEFAULT_INACTIVE_BG_COLOR,
  DEFAULT_INACTIVE_PATTERN,
  DEFAULT_INACTIVE_PATTERN_COLOR,
} from "@/lib/types";
import { INACTIVE_PATTERN_OPTIONS, inactiveBackgroundStyle } from "@/lib/colors";
import { SectionTitle } from "../ui";

const GRADE_SLOTS: { key: keyof GradeColors; label: string }[] = [
  { key: "g1", label: "1학년" },
  { key: "g2", label: "2학년" },
  { key: "g3", label: "3학년" },
  { key: "gm", label: "보강 · 합반" },
];

function GradeColorPicker({
  colors,
  onChange,
}: {
  colors: GradeColors;
  onChange: (c: GradeColors) => void;
}) {
  return (
    <div>
      <div className="label-eyebrow mb-1.5 flex items-center justify-between gap-2">
        <span>색 팔레트 (학년 배지 · 배정 칸 색)</span>
        <button
          type="button"
          className="font-normal normal-case tracking-normal text-clay hover:underline"
          onClick={() => onChange(DEFAULT_GRADE_COLORS)}
        >
          기본값으로
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GRADE_SLOTS.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-2 rounded-md border border-line-strong px-2.5 py-2"
          >
            <input
              type="color"
              value={colors[key]}
              onChange={(e) => onChange({ ...colors, [key]: e.target.value })}
              className="h-7 w-7 shrink-0 cursor-pointer rounded border border-line-strong bg-transparent p-0"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] text-ink-2">{label}</span>
              <input
                value={colors[key]}
                onChange={(e) => onChange({ ...colors, [key]: e.target.value })}
                className="w-full bg-transparent text-[11px] tabular-nums text-ink-3 outline-none"
                maxLength={7}
                spellCheck={false}
              />
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function InactiveColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-line-strong px-2.5 py-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-line-strong bg-transparent p-0"
      />
      <span className="min-w-0">
        <span className="block text-[12px] text-ink-2">{label}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 bg-transparent text-[11px] tabular-nums text-ink-3 outline-none"
          maxLength={7}
          spellCheck={false}
        />
      </span>
    </label>
  );
}

function InactiveStylePicker({
  bgColor,
  patternColor,
  pattern,
  onChangeBgColor,
  onChangePatternColor,
  onChangePattern,
}: {
  bgColor: string;
  patternColor: string;
  pattern: InactivePattern;
  onChangeBgColor: (v: string) => void;
  onChangePatternColor: (v: string) => void;
  onChangePattern: (v: InactivePattern) => void;
}) {
  return (
    <div>
      <div className="label-eyebrow mb-1.5 flex items-center justify-between gap-2">
        <span>비활성 칸 색 · 무늬</span>
        <button
          type="button"
          className="font-normal normal-case tracking-normal text-clay hover:underline"
          onClick={() => {
            onChangeBgColor(DEFAULT_INACTIVE_BG_COLOR);
            onChangePatternColor(DEFAULT_INACTIVE_PATTERN_COLOR);
            onChangePattern(DEFAULT_INACTIVE_PATTERN);
          }}
        >
          기본값으로
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <InactiveColorInput label="배경색" value={bgColor} onChange={onChangeBgColor} />
        <InactiveColorInput label="패턴색" value={patternColor} onChange={onChangePatternColor} />
        <div className="flex flex-wrap gap-1.5">
          {INACTIVE_PATTERN_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChangePattern(opt.key)}
              title={opt.label}
              className={
                "flex flex-col items-center gap-1 rounded-md border px-2 py-1.5 text-[11px] transition-colors " +
                (pattern === opt.key
                  ? "border-clay bg-clay-wash text-ink"
                  : "border-line-strong text-ink-2 hover:bg-paper-2")
              }
            >
              <span
                className="h-6 w-10 rounded border border-line-strong"
                style={inactiveBackgroundStyle(opt.key, bgColor, patternColor)}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const inp =
  "rounded-md border border-line-strong bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-clay";

function SlotList({
  title,
  slots,
  onChange,
}: {
  title: string;
  slots: SlotDef[];
  onChange: (s: SlotDef[]) => void;
}) {
  const set = (i: number, patch: Partial<SlotDef>) =>
    onChange(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div>
      <div className="label-eyebrow mb-1.5">{title}</div>
      <div className="space-y-1.5">
        {slots.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="time"
              step={1800}
              className={inp + " tabular-nums"}
              value={s.start}
              onChange={(e) => set(i, { start: e.target.value })}
            />
            <span className="text-ink-3">–</span>
            <input
              type="time"
              step={1800}
              className={inp + " tabular-nums"}
              value={s.end}
              onChange={(e) => set(i, { end: e.target.value })}
            />
            <button
              type="button"
              className="text-[12px] text-over/80 hover:text-over"
              onClick={() => onChange(slots.filter((_, j) => j !== i))}
            >
              삭제
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-[12px] text-clay hover:underline"
          onClick={() => {
            const last = slots[slots.length - 1];
            const start = last?.end ?? "09:00";
            const [h, m] = start.split(":").map(Number);
            const end = `${String(Math.min(h + 2, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            onChange([...slots, { start, end }]);
          }}
        >
          + 시간블록 추가 (이전 끝 + 2h)
        </button>
      </div>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(s),
    });
    setBusy(false);
    setMsg(res.ok ? "저장되었습니다." : "저장 실패");
    if (res.ok) router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SectionTitle>기본 설정</SectionTitle>

      <div className="grid grid-cols-2 gap-4">
        <label className="col-span-2 flex flex-col gap-1">
          <span className="label-eyebrow">학교명</span>
          <input
            className={inp}
            value={s.school_name}
            onChange={(e) => setS({ ...s, school_name: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-eyebrow">연도</span>
          <input
            type="number"
            className={inp + " tabular-nums"}
            value={s.year}
            onChange={(e) => setS({ ...s, year: Number(e.target.value) })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-eyebrow">기본 표시 월</span>
          <input
            type="number"
            min={1}
            max={12}
            className={inp + " tabular-nums"}
            value={s.month}
            onChange={(e) => setS({ ...s, month: Number(e.target.value) })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-eyebrow">주 시작</span>
          <select
            className={inp}
            value={s.week_start}
            onChange={(e) =>
              setS({ ...s, week_start: e.target.value as "mon" | "sun" })
            }
          >
            <option value="mon">월요일 시작</option>
            <option value="sun">일요일 시작</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label-eyebrow">강의실 (쉼표로 구분)</span>
          <input
            className={inp}
            value={s.rooms.join(", ")}
            onChange={(e) =>
              setS({
                ...s,
                rooms: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <SlotList
          title="평일 시간블록"
          slots={s.time_slots_weekday}
          onChange={(v) => setS({ ...s, time_slots_weekday: v })}
        />
        <SlotList
          title="주말 시간블록"
          slots={s.time_slots_weekend}
          onChange={(v) => setS({ ...s, time_slots_weekend: v })}
        />
      </div>

      <GradeColorPicker
        colors={s.grade_colors ?? DEFAULT_GRADE_COLORS}
        onChange={(v) => setS({ ...s, grade_colors: v })}
      />

      <InactiveStylePicker
        bgColor={s.inactive_bg_color ?? DEFAULT_INACTIVE_BG_COLOR}
        patternColor={s.inactive_pattern_color ?? DEFAULT_INACTIVE_PATTERN_COLOR}
        pattern={s.inactive_pattern ?? DEFAULT_INACTIVE_PATTERN}
        onChangeBgColor={(v) => setS({ ...s, inactive_bg_color: v })}
        onChangePatternColor={(v) => setS({ ...s, inactive_pattern_color: v })}
        onChangePattern={(v) => setS({ ...s, inactive_pattern: v })}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
        {msg && <span className="text-[12px] text-ink-3">{msg}</span>}
      </div>
    </div>
  );
}
