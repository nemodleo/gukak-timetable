"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import type { Pairing } from "@/lib/types";
import { badgeBg, gradeKey } from "@/lib/colors";
import { SectionTitle } from "../ui";

type Row = Partial<Pairing> & { student_name: string };
type SaveState = "idle" | "saving" | "saved" | "error";

const inp =
  "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[13px] outline-none focus:border-clay focus:bg-paper";

function autoLabel(r: Row) {
  const s = (r.student_name ?? "").trim();
  const t = (r.teacher_name ?? "").trim();
  return s ? `${s}${t ? ` (${t}T)` : ""}` : "";
}

function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

function toPayload(rows: Row[]) {
  return rows
    .filter((r) => r.student_name.trim())
    .map((r, i) => ({
      student_name: r.student_name.trim(),
      grade: (r.grade ?? "").trim(),
      teacher_name: (r.teacher_name ?? "").trim(),
      target_hours:
        r.target_hours === undefined ||
        r.target_hours === null ||
        (r.target_hours as unknown) === ""
          ? null
          : Number(r.target_hours),
      label: (r.label ?? "").trim() || autoLabel(r),
      sort_order: i,
      active: r.active ?? true,
    }));
}

export function RosterEditor({ defaultYm }: { defaultYm: string }) {
  const router = useRouter();
  const [ym, setYm] = useState(defaultYm);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savingRef = useRef(false);
  const queuedRef = useRef<{ rows: Row[]; ym: string } | null>(null);

  useEffect(() => {
    const id = ++reqId.current;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMsg(null);
      setCopiedFrom(null);
      setSaveState("idle");
      const res = await fetch(`/api/pairings?ym=${ym}`);
      const data: Pairing[] = res.ok ? await res.json() : [];
      if (cancelled || id !== reqId.current) return;
      setRows(data.map((p) => ({ ...p })));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ym]);

  // ← / → move to the previous / next month
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)
      )
        return;
      e.preventDefault();
      setYm((v) => shiftYm(v, e.key === "ArrowLeft" ? -1 : 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function doSave(rs: Row[], y: string) {
    if (savingRef.current) {
      queuedRef.current = { rows: rs, ym: y };
      return;
    }
    savingRef.current = true;
    setSaveState("saving");
    let ok = false;
    try {
      const res = await fetch("/api/pairings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ym: y, pairings: toPayload(rs) }),
      });
      ok = res.ok;
      if (!ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(`저장 실패: ${j.error ?? res.status}`);
      }
    } catch {
      ok = false;
    }
    savingRef.current = false;
    setSaveState(ok ? "saved" : "error");
    if (ok) {
      setMsg(null);
      setCopiedFrom(null);
      router.refresh();
    }
    const q = queuedRef.current;
    queuedRef.current = null;
    if (q) doSave(q.rows, q.ym);
  }

  function scheduleSave(rs: Row[], y: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => doSave(rs, y), 500);
  }

  const upd = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function copyPrev() {
    const prev = shiftYm(ym, -1);
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/pairings?ym=${prev}`);
    const data: Pairing[] = res.ok ? await res.json() : [];
    setBusy(false);
    if (!data.length) {
      setMsg(`${prev} 명단이 없습니다.`);
      return;
    }
    const next: Row[] = data.map((p) => ({
      student_name: p.student_name,
      grade: p.grade,
      teacher_name: p.teacher_name,
      target_hours: p.target_hours,
      label: p.label,
    }));
    setRows(next);
    setCopiedFrom(prev);
    doSave(next, ym);
  }

  async function removeRow(i: number) {
    const row = rows[i];
    if (
      row.id &&
      !confirm(
        `"${row.label ?? row.student_name}" 를 삭제하면 이 달의 관련 배정 칸도 함께 사라집니다. 계속할까요?`,
      )
    )
      return;
    const next = rows.filter((_, j) => j !== i);
    setRows(next);
    if (row.student_name?.trim() || row.id) doSave(next, ym);
  }

  const empty = !loading && rows.length === 0;

  return (
    <div className="space-y-4">
      <SectionTitle right={<SaveTag state={saveState} loading={loading} />}>
        명단 · {ym}
      </SectionTitle>

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setYm((v) => shiftYm(v, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-ink-2 hover:bg-paper-2"
          >
            ‹
          </button>
          <span className="min-w-[92px] text-center text-[13px] font-medium tabular-nums text-ink-2">
            {ym}
          </span>
          <button
            type="button"
            onClick={() => setYm((v) => shiftYm(v, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-ink-2 hover:bg-paper-2"
          >
            ›
          </button>
        </span>
        {ym !== defaultYm && (
          <button
            type="button"
            onClick={() => setYm(defaultYm)}
            className="rounded border border-line-strong px-2 py-1 text-[11px] text-ink-3 hover:bg-paper-2"
          >
            {defaultYm}로
          </button>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-3">
          {loading ? "불러오는 중…" : `${rows.length}명`}
          {copiedFrom && (
            <span className="text-clay">· {copiedFrom} 명단 불러옴</span>
          )}
          {msg && <span className="text-over">· {msg}</span>}
        </span>
      </div>

      {empty ? (
        <div className="rounded-lg border bg-paper px-4 py-8 text-center text-[13px] text-ink-3">
          <p>{ym} 명단이 비어 있습니다.</p>
          <button
            type="button"
            onClick={copyPrev}
            disabled={busy}
            className="mt-3 rounded-md border border-line-strong px-3.5 py-1.5 text-[13px] text-ink-2 hover:bg-paper-2 disabled:opacity-50"
          >
            {shiftYm(ym, -1)} 명단 불러오기
          </button>
          <span className="mt-2 block text-[12px]">또는 아래에서 직접 추가</span>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-lg border scroll-thin"
          onBlur={() => scheduleSave(rows, ym)}
        >
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="bg-paper-2 text-[11px] text-ink-3">
              <tr>
                <th className="px-2 py-2 font-semibold">학생</th>
                <th className="px-2 py-2 font-semibold">학년</th>
                <th className="px-2 py-2 font-semibold">교사</th>
                <th className="px-2 py-2 text-right font-semibold">목표(h)</th>
                <th className="px-2 py-2 font-semibold">라벨</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const gk = gradeKey(r.grade, r.label);
                return (
                  <tr key={r.id ?? `new-${i}`} className="border-t">
                    <td className="px-2 py-1">
                      <input
                        className={inp}
                        value={r.student_name}
                        onChange={(e) => upd(i, { student_name: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{ background: badgeBg[gk] }}
                        />
                        <input
                          className={inp + " w-16"}
                          value={r.grade ?? ""}
                          onChange={(e) => upd(i, { grade: e.target.value })}
                        />
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className={inp}
                        value={r.teacher_name ?? ""}
                        onChange={(e) => upd(i, { teacher_name: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="1"
                        className={inp + " text-right tabular-nums"}
                        value={r.target_hours ?? ""}
                        onChange={(e) =>
                          upd(i, {
                            target_hours:
                              e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className={inp + " text-ink-3"}
                        placeholder={autoLabel(r)}
                        value={r.label ?? ""}
                        onChange={(e) => upd(i, { label: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-[12px] text-over/70 hover:text-over"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          setRows((r) => [...r, { student_name: "", grade: "", teacher_name: "" }])
        }
        className="text-[13px] text-clay hover:underline"
      >
        + 행 추가
      </button>
    </div>
  );
}

function SaveTag({ state, loading }: { state: SaveState; loading: boolean }) {
  if (loading) return null;
  const map: Record<SaveState, { t: string; c: string } | null> = {
    idle: null,
    saving: { t: "저장 중…", c: "text-ink-3" },
    saved: { t: "저장됨", c: "text-clay" },
    error: { t: "저장 실패", c: "text-over" },
  };
  const v = map[state];
  return v ? <span className={clsx("text-[12px]", v.c)}>{v.t}</span> : null;
}
