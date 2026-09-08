"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Settings, SlotDef } from "@/lib/types";
import { SectionTitle } from "../ui";

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
      <SectionTitle sub="엑셀 SET UP 시트에 해당합니다.">기본 설정</SectionTitle>

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
