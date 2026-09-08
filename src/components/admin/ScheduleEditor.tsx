"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type {
  Cell,
  CellColor,
  DayConfig,
  DayMemo,
  MemoLine,
  Pairing,
  Settings,
  SlotDef,
} from "@/lib/types";
import {
  addDays,
  fmtDayHeader,
  iso,
  parseIso,
  roomsForDate,
  slotsForDate,
  startOfWeekKey,
  weekFromKey,
  ymOf,
} from "@/lib/schedule";
import { fromMin, toMin } from "@/lib/time";
import { keyOf } from "@/lib/cellIndex";
import { CELL_COLOR_OPTIONS, blockCellBg } from "@/lib/colors";
import { DayGrid, EMPTY_MEMO_LINES } from "../DayGrid";
import { DayCapture } from "../DayCapture";

type Draft = { date: string; room: string; slot: number };
type Struct = { rooms: string[]; slots: SlotDef[] };

const DAY_MAX = toMin("29:00"); // allow blocks a few hours past midnight

export function ScheduleEditor({
  settings,
  pairings,
  initialCells,
  initialMemos,
  initialConfigs,
  year,
  month,
  initialWeekKey,
  dayOnly,
  isAdmin = false,
  readOnly = false,
}: {
  settings: Settings;
  pairings: Pairing[];
  initialCells: Cell[];
  initialMemos: DayMemo[];
  initialConfigs: DayConfig[];
  year: number;
  month: number;
  /** lock the editor to a specific week (defaults to first week of year/month) */
  initialWeekKey?: string;
  /** render only this one day (for /day) */
  dayOnly?: string;
  /** admin unlocks grid structure editing (rooms/blocks) + the drag "회색 지정" tool */
  isAdmin?: boolean;
  /** 학생 보기 모드 — no editing at all */
  readOnly?: boolean;
}) {
  const firstWeekKey =
    initialWeekKey ??
    startOfWeekKey(new Date(year, month - 1, 1), settings.week_start);
  const [weekKey, setWeekKey] = useState(firstWeekKey);
  const [cells, setCells] = useState<Map<string, Cell>>(
    () => new Map(initialCells.map((c) => [keyOf(c.date, c.room, c.slot_index), c])),
  );
  const [memos, setMemos] = useState<Map<string, Record<string, MemoLine>>>(
    () => new Map(initialMemos.map((m) => [m.date, m.lines])),
  );
  const [serverCfg, setServerCfg] = useState<Map<string, DayConfig>>(
    () => new Map(initialConfigs.map((c) => [c.date, c])),
  );
  const [struct, setStruct] = useState<Map<string, Struct>>(new Map());
  const [structState, setStructState] = useState<
    Map<string, "pending" | "saving" | "saved" | "error">
  >(new Map());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paint, setPaint] = useState(false);
  /** 칸 편집 되돌리기 스택 — 각 항목은 한 번의 편집(칸 여러 개 가능) */
  type UndoOp = { date: string; room: string; slot: number; before: Cell | null };
  const [undoStack, setUndoStack] = useState<UndoOp[][]>([]);
  const undoStackRef = useRef<UndoOp[][]>([]);
  const doUndoRef = useRef<() => void>(() => {});
  const loaded = useRef<Set<string>>(new Set([firstWeekKey]));
  const memoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const structTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const structSaving = useRef<Set<string>>(new Set());
  const structAgain = useRef<Set<string>>(new Set());
  const runStructSaveRef = useRef<(date: string) => void>(() => {});

  const setSState = (date: string, v: ReturnType<typeof structState.get>) =>
    setStructState((prev) => {
      const n = new Map(prev);
      if (v) n.set(date, v);
      else n.delete(date);
      return n;
    });

  const week = useMemo(() => weekFromKey(weekKey), [weekKey]);
  const pById = useMemo(() => new Map(pairings.map((p) => [p.id, p])), [pairings]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const effStruct = useCallback(
    (date: string): Struct => {
      const local = struct.get(date);
      if (local) return local;
      const sc = serverCfg.get(date);
      const d = parseIso(date);
      return {
        rooms: sc?.rooms?.length ? sc.rooms : roomsForDate(d, settings),
        slots: sc?.slots?.length ? sc.slots : slotsForDate(d, settings),
      };
    },
    [struct, serverCfg, settings],
  );

  const loadWeek = useCallback(async (wk: string) => {
    if (loaded.current.has(wk)) return;
    const w = weekFromKey(wk);
    const from = iso(w.start);
    const to = iso(w.end);
    const [rc, rm, rcfg] = await Promise.all([
      fetch(`/api/schedule?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/memos?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/day-config?from=${from}&to=${to}`).then((r) => (r.ok ? r.json() : [])),
    ]);
    setCells((prev) => {
      const next = new Map(prev);
      for (const c of rc as Cell[]) next.set(keyOf(c.date, c.room, c.slot_index), c);
      return next;
    });
    setMemos((prev) => {
      const next = new Map(prev);
      for (const m of rm as DayMemo[]) next.set(m.date, m.lines);
      return next;
    });
    setServerCfg((prev) => {
      const next = new Map(prev);
      for (const c of rcfg as DayConfig[]) next.set(c.date, c);
      return next;
    });
    loaded.current.add(wk);
  }, []);

  useEffect(() => {
    loadWeek(weekKey);
  }, [weekKey, loadWeek]);

  /* ---------------- cells ---------------- */
  /** Cell -> PUT body that restores it (null = clear the cell) */
  function restoreBody(
    c: Cell | null,
  ): {
    kind: "pairing" | "block" | null;
    pairing_id?: string | null;
    text?: string | null;
    color?: CellColor | null;
  } {
    if (!c) return { kind: null };
    if (c.kind === "pairing")
      return { kind: "pairing", pairing_id: c.pairing_id };
    return { kind: "block", text: c.text, color: c.color };
  }

  function pushUndo(ops: UndoOp[]) {
    setUndoStack((s) => [...s.slice(-49), ops]);
  }

  async function undo() {
    const stack = undoStackRef.current;
    const ops = stack[stack.length - 1];
    if (!ops || !ops.length) return;
    setUndoStack((s) => s.slice(0, -1));
    const body = ops.map((o) => ({
      date: o.date,
      room: o.room,
      slot_index: o.slot,
      ...restoreBody(o.before),
    }));
    const res = await fetch("/api/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      flash(`되돌리기 실패: ${j.error ?? res.status}`);
      return;
    }
    setCells((prev) => {
      const next = new Map(prev);
      for (const o of ops!) {
        const k = keyOf(o.date, o.room, o.slot);
        if (o.before) next.set(k, o.before);
        else next.delete(k);
      }
      return next;
    });
    flash("되돌렸습니다");
  }

  async function saveCell(
    d: Draft,
    body: {
      kind: "pairing" | "block" | null;
      pairing_id?: string | null;
      text?: string | null;
      color?: CellColor | null;
    },
  ) {
    const before = cells.get(keyOf(d.date, d.room, d.slot)) ?? null;
    const res = await fetch("/api/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: d.date, room: d.room, slot_index: d.slot, ...body }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      flash(`저장 실패: ${j.error ?? res.status}`);
      return;
    }
    pushUndo([{ date: d.date, room: d.room, slot: d.slot, before }]);
    setCells((prev) => {
      const next = new Map(prev);
      const k = keyOf(d.date, d.room, d.slot);
      const empty = !body.kind || (body.kind === "pairing" && !body.pairing_id);
      if (empty) next.delete(k);
      else
        next.set(k, {
          id: prev.get(k)?.id ?? `tmp-${k}`,
          date: d.date,
          room: d.room,
          slot_index: d.slot,
          kind: body.kind!,
          pairing_id: body.kind === "pairing" ? body.pairing_id ?? null : null,
          text: body.kind === "block" ? body.text ?? null : null,
          color: body.kind === "block" ? body.color ?? null : null,
        });
      return next;
    });
    setDraft(null);
  }

  async function paintCells(
    targets: { room: string; slot: number }[],
    value: "block" | "clear",
    date: string,
  ) {
    const undoOps = targets.map((t) => ({
      date,
      room: t.room,
      slot: t.slot,
      before: cells.get(keyOf(date, t.room, t.slot)) ?? null,
    }));
    const body = targets.map((t) => ({
      date,
      room: t.room,
      slot_index: t.slot,
      kind: value === "block" ? ("block" as const) : null,
    }));
    const res = await fetch("/api/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      flash(`저장 실패: ${j.error ?? res.status}`);
      return;
    }
    pushUndo(undoOps);
    setCells((prev) => {
      const next = new Map(prev);
      for (const t of targets) {
        const k = keyOf(date, t.room, t.slot);
        if (value === "block")
          next.set(k, {
            id: prev.get(k)?.id ?? `tmp-${k}`,
            date,
            room: t.room,
            slot_index: t.slot,
            kind: "block",
            pairing_id: null,
            text: null,
            color: null,
          });
        else next.delete(k);
      }
      return next;
    });
  }

  /* ---------------- memo (autosave) ---------------- */
  function changeMemo(date: string, hhmm: string, line: MemoLine | null) {
    setMemos((prev) => {
      const cur = { ...(prev.get(date) ?? {}) };
      if (line) cur[hhmm] = line;
      else delete cur[hhmm];
      const next = new Map(prev).set(date, cur);
      // debounced PUT of the whole day
      const timers = memoTimers.current;
      if (timers.has(date)) clearTimeout(timers.get(date)!);
      timers.set(
        date,
        setTimeout(() => {
          fetch("/api/memos", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ date, lines: cur }),
          }).catch(() => {});
        }, 450),
      );
      return next;
    });
  }

  /* ---------------- structure (auto-saved) ---------------- */
  function scheduleStructSave(date: string) {
    const t = structTimers.current;
    if (t.has(date)) clearTimeout(t.get(date)!);
    setSState(date, "pending");
    t.set(
      date,
      setTimeout(() => {
        t.delete(date);
        runStructSaveRef.current(date);
      }, 700),
    );
  }

  function setStructFor(date: string, next: Struct, remap?: (m: Map<string, Cell>) => void) {
    setStruct((prev) => new Map(prev).set(date, next));
    if (remap)
      setCells((prev) => {
        const m = new Map(prev);
        remap(m);
        return m;
      });
    scheduleStructSave(date);
  }

  function addBlock(date: string) {
    const s = effStruct(date);
    const last = s.slots[s.slots.length - 1];
    // start right after the previous block; always a full 2h (grid grows down)
    const startC = Math.min(last ? toMin(last.end) : toMin("09:00"), DAY_MAX - 120);
    const end = startC + 120;
    setStructFor(date, {
      rooms: s.rooms,
      slots: [...s.slots, { start: fromMin(startC), end: fromMin(end) }],
    });
  }

  function insertBlock(date: string, start: string, end: string) {
    const s = effStruct(date);
    const idx = s.slots.filter((x) => toMin(x.start) < toMin(start)).length;
    const slots = [
      ...s.slots.slice(0, idx),
      { start, end },
      ...s.slots.slice(idx),
    ];
    setStructFor(date, { rooms: s.rooms, slots }, (m) => {
      // shift cells at slot_index >= idx up by one
      for (const [k, c] of [...m]) {
        if (c.date !== date || c.slot_index < idx) continue;
        m.delete(k);
        const nc = { ...c, slot_index: c.slot_index + 1 };
        m.set(keyOf(nc.date, nc.room, nc.slot_index), nc);
      }
    });
  }

  function editBlock(date: string, i: number, patch: Partial<SlotDef>) {
    const s = effStruct(date);
    const slots = s.slots.map((x, j) => (j === i ? { ...x, ...patch } : x));
    // clamp against neighbours (array order is slot_index; keep it)
    const cur = slots[i];
    let st = toMin(cur.start);
    let en = toMin(cur.end);
    const prev = slots[i - 1];
    const nxt = slots[i + 1];
    if (prev && st < toMin(prev.end)) st = toMin(prev.end);
    if (nxt && en > toMin(nxt.start)) en = toMin(nxt.start);
    if (en <= st) en = Math.min(st + 30, DAY_MAX);
    slots[i] = { ...cur, start: fromMin(st), end: fromMin(en) };
    setStructFor(date, { rooms: s.rooms, slots });
  }

  function deleteBlock(date: string, i: number) {
    const s = effStruct(date);
    setStructFor(
      date,
      { rooms: s.rooms, slots: s.slots.filter((_, j) => j !== i) },
      (m) => {
        for (const [k, c] of [...m]) {
          if (c.date !== date) continue;
          if (c.slot_index === i) m.delete(k);
          else if (c.slot_index > i) {
            m.delete(k);
            const nc = { ...c, slot_index: c.slot_index - 1 };
            m.set(keyOf(nc.date, nc.room, nc.slot_index), nc);
          }
        }
      },
    );
  }

  function editRoom(date: string, i: number, name: string) {
    const s = effStruct(date);
    const old = s.rooms[i];
    const rooms = s.rooms.map((r, j) => (j === i ? name : r));
    setStructFor(date, { rooms, slots: s.slots }, (m) => {
      if (!name || name === old) return;
      for (const [k, c] of [...m]) {
        if (c.date !== date || c.room !== old) continue;
        m.delete(k);
        const nc = { ...c, room: name };
        m.set(keyOf(nc.date, nc.room, nc.slot_index), nc);
      }
    });
  }

  function deleteRoom(date: string, i: number) {
    const s = effStruct(date);
    if (s.rooms.length <= 1) return;
    const gone = s.rooms[i];
    setStructFor(date, { rooms: s.rooms.filter((_, j) => j !== i), slots: s.slots }, (m) => {
      for (const [k, c] of [...m]) if (c.date === date && c.room === gone) m.delete(k);
    });
  }

  function addRoom(date: string) {
    const s = effStruct(date);
    setStructFor(date, { rooms: [...s.rooms, `강의실 ${s.rooms.length + 1}`], slots: s.slots });
  }

  async function doStructSave(date: string): Promise<boolean> {
    const s = effStruct(date);
    const roomSet = new Set(s.rooms);
    const finalCells = [...cells.values()]
      .filter((c) => c.date === date && roomSet.has(c.room) && c.slot_index < s.slots.length)
      .map((c) => ({
        date: c.date,
        room: c.room,
        slot_index: c.slot_index,
        kind: c.kind,
        pairing_id: c.pairing_id,
        text: c.text,
      }));
    try {
      let r = await fetch("/api/day-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, rooms: s.rooms, slots: s.slots }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? r.status);
      r = await fetch(`/api/schedule?date=${date}`, { method: "DELETE" });
      if (!r.ok) throw new Error("cells clear");
      if (finalCells.length) {
        r = await fetch("/api/schedule", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(finalCells),
        });
        if (!r.ok) throw new Error("cells write");
      }
    } catch (e) {
      flash(`구조 저장 실패: ${e instanceof Error ? e.message : e}`);
      return false;
    }
    setServerCfg((prev) => new Map(prev).set(date, { date, rooms: s.rooms, slots: s.slots }));
    return true;
  }

  async function runStructSave(date: string) {
    if (structSaving.current.has(date)) {
      structAgain.current.add(date); // coalesce — run once more after the current save
      return;
    }
    structSaving.current.add(date);
    setSState(date, "saving");
    const ok = await doStructSave(date);
    structSaving.current.delete(date);
    if (structAgain.current.has(date)) {
      structAgain.current.delete(date);
      runStructSave(date);
      return;
    }
    setSState(date, ok ? "saved" : "error");
  }
  useEffect(() => {
    runStructSaveRef.current = runStructSave;
    doUndoRef.current = undo;
    undoStackRef.current = undoStack;
  });

  // Cmd/Ctrl+Z → 마지막 칸 편집 되돌리기 (입력창 안에서는 브라우저 기본 undo)
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== "z")
        return;
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      e.preventDefault();
      doUndoRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly]);

  // flush any pending structural save when navigating to another week / unmounting
  useEffect(() => {
    const timers = structTimers.current;
    return () => {
      for (const [d, t] of timers) {
        clearTimeout(t);
        timers.delete(d);
        runStructSaveRef.current(d);
      }
    };
  }, [weekKey]);

  async function resetStruct(date: string) {
    if (!confirm(`${date} 의 시간·강의실을 기본값으로 되돌릴까요?`)) return;
    const t = structTimers.current.get(date);
    if (t) {
      clearTimeout(t);
      structTimers.current.delete(date);
    }
    const res = await fetch(`/api/day-config?date=${date}`, { method: "DELETE" });
    if (!res.ok) return flash("되돌리기 실패");
    setServerCfg((prev) => {
      const n = new Map(prev);
      n.delete(date);
      return n;
    });
    setStruct((prev) => {
      const n = new Map(prev);
      n.delete(date);
      return n;
    });
    setSState(date, undefined);
    flash("기본값으로 되돌림");
  }

  const embedded = initialWeekKey != null;
  const shownDays = dayOnly
    ? week.days.filter((d) => iso(d) === dayOnly)
    : week.days;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          {!embedded && !dayOnly && (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setWeekKey(iso(addDays(week.start, -7)))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-ink-2 hover:bg-paper-2"
              >
                ‹
              </button>
              <span className="min-w-[168px] text-center text-[13px] font-medium tabular-nums text-ink-2">
                {iso(week.start)} ~ {iso(week.end)}
              </span>
              <button
                type="button"
                onClick={() => setWeekKey(iso(addDays(week.start, 7)))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-ink-2 hover:bg-paper-2"
              >
                ›
              </button>
            </span>
          )}
          {isAdmin && !readOnly && (
            <button
              type="button"
              onClick={() => setPaint((p) => !p)}
              className={clsx(
                "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                paint
                  ? "border-clay bg-clay text-paper"
                  : "border-line-strong text-ink-2 hover:bg-paper-2",
              )}
            >
              {paint ? "회색 지정 중 — 드래그하세요" : "회색 지정"}
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => undo()}
              disabled={undoStack.length === 0}
              title="되돌리기 (⌘/Ctrl+Z)"
              className="rounded-full border border-line-strong px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:bg-paper-2 disabled:opacity-40"
            >
              ↶ 되돌리기
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <DayCapture
            days={shownDays.map((d) => {
              const date = iso(d);
              const s = effStruct(date);
              return { date, rooms: s.rooms, slots: s.slots };
            })}
            zipName={`week-${weekKey}.zip`}
            label={shownDays.length > 1 ? "주 전체 저장 (zip)" : "이미지 저장"}
            pairings={pairings}
            cells={[...cells.values()]}
            memos={[...memos].map(([date, lines]) => ({ date, lines }))}
          />
        </div>
      </div>

      {!readOnly && (
        <p className="text-[11px] leading-snug text-ink-3">
          {isAdmin
            ? "칸 클릭 = 배정/비수업 편집(비수업은 메모·색 지정 가능) · 머리글의 강의실·블록은 클릭해 수정, 호버 시 ✕ 삭제, 끝 + 추가 · 모든 변경은 자동 저장됩니다."
            : "칸을 클릭해 학생(교사) 배정을 지정합니다. 비수업 칸과 강의실·시간블록 구조는 관리자만 수정합니다. 모든 변경은 자동 저장됩니다."}
        </p>
      )}

      <div className="overflow-x-auto scroll-thin pb-8">
        <div
          className={clsx(
            "flex items-start gap-3",
            dayOnly && "justify-center",
          )}
        >
          {shownDays.map((d) => {
            const date = iso(d);
            const st = effStruct(date);
            return (
              <EditableDay
                key={date}
                date={date}
                wide={Boolean(dayOnly)}
                readOnly={readOnly}
                canStruct={isAdmin && !readOnly}
                struct={st}
                hasOverride={serverCfg.has(date)}
                saveState={structState.get(date)}
                cells={cells}
                pairings={pairings}
                pById={pById}
                memoLines={memos.get(date) ?? EMPTY_MEMO_LINES}
                onCellClick={
                  readOnly
                    ? undefined
                    : (room, slot) => {
                        // 비수업 칸은 관리자만 수정 가능
                        const cur = cells.get(keyOf(date, room, slot));
                        if (cur?.kind === "block" && !isAdmin) return;
                        setDraft({ date, room, slot });
                      }
                }
                onMemoChange={(hhmm, line) => changeMemo(date, hhmm, line)}
                onAddBlock={() => addBlock(date)}
                onInsertBlock={(start, end) => insertBlock(date, start, end)}
                onEditBlock={(i, patch) => editBlock(date, i, patch)}
                onDeleteBlock={(i) => deleteBlock(date, i)}
                onAddRoom={() => addRoom(date)}
                onEditRoom={(i, name) => editRoom(date, i, name)}
                onDeleteRoom={(i) => deleteRoom(date, i)}
                onResetStruct={() => resetStruct(date)}
                paintMode={isAdmin && !readOnly && paint}
                onPaint={(targets, value) => paintCells(targets, value, date)}
              />
            );
          })}
        </div>
      </div>

      {draft && (
        <CellEditor
          draft={draft}
          pairings={pairings}
          canBlock={isAdmin}
          current={cells.get(keyOf(draft.date, draft.room, draft.slot))}
          onClose={() => setDraft(null)}
          onSave={(body) => saveCell(draft, body)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] text-paper">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ================================================================= */

function SaveState({
  state,
}: {
  state?: "pending" | "saving" | "saved" | "error";
}) {
  if (!state) return null;
  const map = {
    pending: { t: "저장 대기…", c: "text-ink-3" },
    saving: { t: "저장 중…", c: "text-ink-3" },
    saved: { t: "저장됨", c: "text-clay" },
    error: { t: "저장 실패", c: "text-over" },
  } as const;
  const { t, c } = map[state];
  return <span className={clsx("text-[10px]", c)}>{t}</span>;
}

function EditableDay({
  date,
  wide,
  readOnly,
  canStruct,
  struct,
  hasOverride,
  saveState,
  cells,
  pairings,
  pById,
  memoLines,
  onCellClick,
  onMemoChange,
  onAddBlock,
  onInsertBlock,
  onEditBlock,
  onDeleteBlock,
  onAddRoom,
  onEditRoom,
  onDeleteRoom,
  onResetStruct,
  paintMode,
  onPaint,
}: {
  date: string;
  wide?: boolean;
  readOnly?: boolean;
  canStruct?: boolean;
  struct: Struct;
  hasOverride: boolean;
  saveState?: "pending" | "saving" | "saved" | "error";
  cells: Map<string, Cell>;
  pairings: Pairing[];
  pById: Map<string, Pairing>;
  memoLines: Record<string, MemoLine>;
  onCellClick?: (room: string, slot: number) => void;
  onMemoChange: (hhmm: string, line: MemoLine | null) => void;
  onAddBlock: () => void;
  onInsertBlock: (start: string, end: string) => void;
  onEditBlock: (i: number, patch: Partial<SlotDef>) => void;
  onDeleteBlock: (i: number) => void;
  onAddRoom: () => void;
  onEditRoom: (i: number, name: string) => void;
  onDeleteRoom: (i: number) => void;
  onResetStruct: () => void;
  paintMode: boolean;
  onPaint: (targets: { room: string; slot: number }[], value: "block" | "clear") => void;
}) {
  const d = parseIso(date);
  const { rooms, slots } = struct;
  void pById;

  return (
    <section
      id={`capday-${date}`}
      className={clsx(
        "flex shrink-0 flex-col overflow-hidden rounded-lg border bg-paper",
        wide ? "w-full max-w-[920px]" : "w-[640px]",
      )}
    >
      <header className="relative border-b bg-clay-wash/60 px-3.5 py-2">
        <span className="font-serif text-[15px] font-medium">{fmtDayHeader(d)}</span>
        <div
          className="absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center gap-2"
          data-no-capture
        >
          {canStruct && <SaveState state={saveState} />}
          {canStruct && hasOverride && (
            <button
              type="button"
              onClick={onResetStruct}
              className="rounded border border-line-strong px-1.5 py-0.5 text-[10px] text-ink-3 hover:bg-paper-2"
            >
              기본값
            </button>
          )}
        </div>
      </header>

      <DayGrid
        date={date}
        rooms={rooms}
        slots={slots}
        cellIndex={cells}
        pairings={pairings}
        memo={{
          mode: readOnly ? "read" : "edit",
          lines: memoLines,
          onChange: onMemoChange,
        }}
        editable={!readOnly}
        rowH={wide ? 19 : 15}
        paintMode={paintMode}
        onCellClick={onCellClick}
        onPaint={onPaint}
        structEdit={
          canStruct
            ? {
                onRenameRoom: onEditRoom,
                onDeleteRoom,
                onAddRoom,
                onRetimeBlock: onEditBlock,
                onDeleteBlock,
                onAddBlock,
                onInsertBlock,
              }
            : undefined
        }
      />
    </section>
  );
}

/* ================================================================= */

function CellEditor({
  draft,
  pairings,
  canBlock,
  current,
  onClose,
  onSave,
}: {
  draft: Draft;
  pairings: Pairing[];
  canBlock: boolean;
  current?: Cell;
  onClose: () => void;
  onSave: (body: {
    kind: "pairing" | "block" | null;
    pairing_id?: string | null;
    text?: string | null;
    color?: CellColor | null;
  }) => void;
}) {
  const modes = canBlock
    ? (["pairing", "block"] as const)
    : (["pairing"] as const);
  const [mode, setMode] = useState<"pairing" | "block">(
    current?.kind === "block" && canBlock ? "block" : "pairing",
  );
  const [pid, setPid] = useState<string>(current?.pairing_id ?? "");
  const [text, setText] = useState<string>(current?.text ?? "");
  const [color, setColor] = useState<CellColor | null>(current?.color ?? null);
  const [q, setQ] = useState("");
  // only offer the roster for the month this cell falls in (a week view may hold
  // two months' rosters); fall back to all if that month has none loaded.
  const ym = ymOf(draft.date);
  const monthPairings = pairings.some((p) => p.ym === ym)
    ? pairings.filter((p) => p.ym === ym)
    : pairings;
  const filtered = monthPairings.filter(
    (p) => !q || p.label.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-paper p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h3 className="font-serif text-[15px] font-medium">
            {draft.date} · {draft.room} · {draft.slot + 1}번째 블록
          </h3>
          <button type="button" onClick={onClose} className="text-ink-3 hover:text-ink">
            ✕
          </button>
        </div>

        {modes.length > 1 && (
          <div className="mt-4 flex gap-1 rounded-full border p-1 text-[12px]">
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={clsx(
                  "flex-1 rounded-full px-2.5 py-1.5",
                  mode === m ? "bg-ink text-paper" : "text-ink-2",
                )}
              >
                {m === "pairing" ? "학생(교사)" : "비수업"}
              </button>
            ))}
          </div>
        )}

        {mode === "pairing" ? (
          <div className="mt-3 space-y-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="검색"
              className="w-full rounded-md border border-line-strong bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-clay"
            />
            <select
              size={7}
              value={pid}
              onChange={(e) => setPid(e.target.value)}
              className="w-full rounded-md border border-line-strong bg-paper p-1 text-[13px] outline-none focus:border-clay"
            >
              {filtered.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] leading-snug text-ink-3">
              수업 없는 시간대(비수업)입니다. 메모는 선택 사항이며, 기본 배경은 사선입니다.
            </p>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="비수업 메모 (선택) — 예) 6:20-8 성대k 김"
              className="w-full resize-y rounded-md border border-line-strong bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-clay"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-3">배경</span>
              <button
                type="button"
                title="기본 (사선)"
                onClick={() => setColor(null)}
                className={clsx(
                  "h-6 w-6 rounded border text-[10px] text-ink-3",
                  color == null ? "border-clay ring-1 ring-clay" : "border-line-strong",
                )}
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(135deg, var(--color-paper-2) 0 4px, #e2dcd2 4px 5px)",
                }}
              />
              {CELL_COLOR_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  title={o.label}
                  onClick={() => setColor(o.key)}
                  className={clsx(
                    "h-6 w-6 rounded border",
                    color === o.key
                      ? "border-clay ring-1 ring-clay"
                      : "border-line-strong",
                  )}
                  style={{ background: blockCellBg[o.key] }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onSave({ kind: null })}
            className="text-[12px] text-over/80 hover:text-over"
          >
            칸 비우기
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line-strong px-3 py-1.5 text-[13px] text-ink-2"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() =>
                mode === "pairing"
                  ? onSave({ kind: "pairing", pairing_id: pid || null })
                  : onSave({ kind: "block", text: text.trim() || null, color })
              }
              className="rounded-md bg-ink px-3 py-1.5 text-[13px] text-paper"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
