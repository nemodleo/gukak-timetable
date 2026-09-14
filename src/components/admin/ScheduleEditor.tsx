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
  sortSlots,
  startOfWeekKey,
  weekFromKey,
  ymOf,
} from "@/lib/schedule";
import { fromMin, toMin } from "@/lib/time";
import { hasCellContent, keyOf } from "@/lib/cellIndex";
import { CELL_COLOR_OPTIONS, blockCellBg } from "@/lib/colors";
import { DayGrid, EMPTY_MEMO_LINES, type DnDCtl } from "../DayGrid";
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
  viewToggle,
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
  /** 보기/편집 토글 (ScheduleBoard가 렌더) — 툴바 맨 앞에 한 줄로 같이 배치 */
  viewToggle?: React.ReactNode;
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
  const [dragFrom, setDragFrom] = useState<Draft | null>(null);
  const [dragOver, setDragOver] = useState<Draft | null>(null);
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
      body: JSON.stringify({
        date: d.date,
        room: d.room,
        slot_index: d.slot,
        ...body,
        // 내용 편집은 비활성 지정 상태를 건드리지 않는다(기존 상태 유지)
        active: before?.active ?? true,
      }),
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
          active: before?.active ?? true,
        });
      return next;
    });
    setDraft(null);
  }

  // 칸 드래그 이동 — 배정(강사+관리자)·비활성(관리자만) 칸을 다른 시간/칸으로.
  // 이동 = 대상 칸에 그대로 쓰고 원래 칸을 비움; 시수는 어디서든 slotHours(date, slot_index)로
  // 그때그때 계산되므로 칸만 옮기면 통계·포화도가 저절로 다시 맞습니다.
  function canDragCell(cell: Cell | undefined): boolean {
    if (readOnly || !cell) return false;
    return cell.kind === "block" || cell.active === false ? isAdmin : true;
  }

  async function moveCell(from: Draft, to: Draft) {
    setDragFrom(null);
    setDragOver(null);
    if (keyOf(from.date, from.room, from.slot) === keyOf(to.date, to.room, to.slot))
      return;
    const src = cells.get(keyOf(from.date, from.room, from.slot));
    if (!src || !canDragCell(src)) return;
    const destBefore = cells.get(keyOf(to.date, to.room, to.slot)) ?? null;
    if (destBefore) {
      const label =
        destBefore.kind === "pairing"
          ? (pById.get(destBefore.pairing_id ?? "")?.label ?? "배정")
          : "비활성 칸";
      if (!confirm(`이동할 칸에 이미 "${label}" 이(가) 있습니다. 덮어쓸까요?`)) return;
    }
    const body = [
      {
        date: to.date,
        room: to.room,
        slot_index: to.slot,
        kind: src.kind,
        pairing_id: src.kind === "pairing" ? src.pairing_id : null,
        text: src.kind === "block" ? src.text : null,
        color: src.kind === "block" ? src.color : null,
        active: src.active,
      },
      { date: from.date, room: from.room, slot_index: from.slot, kind: null },
    ];
    const res = await fetch("/api/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      flash(`이동 실패: ${j.error ?? res.status}`);
      return;
    }
    pushUndo([
      { date: to.date, room: to.room, slot: to.slot, before: destBefore },
      { date: from.date, room: from.room, slot: from.slot, before: src },
    ]);
    setCells((prev) => {
      const next = new Map(prev);
      next.delete(keyOf(from.date, from.room, from.slot));
      next.set(keyOf(to.date, to.room, to.slot), {
        ...src,
        date: to.date,
        room: to.room,
        slot_index: to.slot,
      });
      return next;
    });
    flash("이동했습니다");
  }

  /** 비활성 지정/해제 — 내용(배정·텍스트)은 그대로 두고 active만 바꾼다.
   *  기존에 아무 내용도 없던 칸을 비활성으로 지정할 땐 잠금 표시용 빈 block
   *  칸을 만들고, 그런 칸을 다시 활성화할 땐(내용이 없으므로) 그냥 지운다. */
  async function paintCells(
    targets: { room: string; slot: number }[],
    value: "deactivate" | "activate",
    date: string,
  ) {
    const items = targets
      .map((t) => {
        const before = cells.get(keyOf(date, t.room, t.slot)) ?? null;
        if (value === "activate" && !before) return null; // 없던 걸 활성화할 것도 없음
        return { t, before };
      })
      .filter((x): x is { t: { room: string; slot: number }; before: Cell | null } => x !== null);
    if (!items.length) return;

    const undoOps = items.map(({ t, before }) => ({ date, room: t.room, slot: t.slot, before }));
    const body = items.map(({ t, before }) => {
      if (value === "deactivate") {
        if (before && hasCellContent(before))
          return {
            date,
            room: t.room,
            slot_index: t.slot,
            kind: before.kind,
            pairing_id: before.kind === "pairing" ? before.pairing_id : null,
            text: before.kind === "block" ? before.text : null,
            color: before.kind === "block" ? before.color : null,
            active: false,
          };
        return {
          date,
          room: t.room,
          slot_index: t.slot,
          kind: "block" as const,
          pairing_id: null,
          text: null,
          color: null,
          active: false,
        };
      }
      // activate
      if (before && hasCellContent(before))
        return {
          date,
          room: t.room,
          slot_index: t.slot,
          kind: before.kind,
          pairing_id: before.kind === "pairing" ? before.pairing_id : null,
          text: before.kind === "block" ? before.text : null,
          color: before.kind === "block" ? before.color : null,
          active: true,
        };
      return { date, room: t.room, slot_index: t.slot, kind: null }; // 내용 없던 잠금칸 -> 완전히 비움
    });
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
      for (const { t, before } of items) {
        const k = keyOf(date, t.room, t.slot);
        if (value === "deactivate") {
          if (before && hasCellContent(before)) next.set(k, { ...before, active: false });
          else
            next.set(k, {
              id: prev.get(k)?.id ?? `tmp-${k}`,
              date,
              room: t.room,
              slot_index: t.slot,
              kind: "block",
              pairing_id: null,
              text: null,
              color: null,
              active: false,
            });
        } else {
          if (before && hasCellContent(before)) next.set(k, { ...before, active: true });
          else next.delete(k);
        }
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

  /** drag-reorder a room column — cells reference rooms by name, not
   *  position, so no cell remap is needed. (Time blocks aren't reorderable
   *  this way: the grid places them by clock time via gridGeom, so moving
   *  a block's array position has no visual effect.) */
  function reorderRoom(date: string, from: number, to: number) {
    const s = effStruct(date);
    if (from === to || from < 0 || to < 0 || from >= s.rooms.length || to >= s.rooms.length)
      return;
    const rooms = [...s.rooms];
    const [moved] = rooms.splice(from, 1);
    rooms.splice(to, 0, moved);
    setStructFor(date, { rooms, slots: s.slots });
  }

  /** drag a time block's label onto an empty gap — reschedules the block
   *  (duration preserved) instead of reordering its array position, since
   *  the grid places blocks by clock time via gridGeom, not array order.
   *  cells reference blocks by slot_index, so re-sorting the slots array
   *  after the move requires remapping every affected cell's slot_index. */
  /** shared tail for any structural edit that changes one or more slots'
   *  start/end times: sorts the updated slots by their new start time and
   *  remaps every affected cell's slot_index from its old array position
   *  to its new one (cells reference blocks positionally, unlike rooms). */
  function commitSlotTimes(date: string, rooms: string[], updatedSlots: SlotDef[]) {
    const sorted = sortSlots(updatedSlots);
    // old index -> new index, via each slot's identity (object reference
    // survives the sort/map above, so match by reference).
    const newIndexOf = new Map(sorted.map((sl, newI) => [sl, newI]));
    const perm = updatedSlots.map((sl) => newIndexOf.get(sl)!);

    setStructFor(date, { rooms, slots: sorted }, (m) => {
      const moved: Array<{ key: string; cell: Cell }> = [];
      for (const [k, c] of [...m]) {
        if (c.date !== date || c.slot_index >= perm.length) continue;
        const newIdx = perm[c.slot_index];
        if (newIdx === c.slot_index) continue;
        m.delete(k);
        moved.push({ key: k, cell: { ...c, slot_index: newIdx } });
      }
      for (const { cell } of moved) {
        m.set(keyOf(cell.date, cell.room, cell.slot_index), cell);
      }
    });
  }

  function moveBlock(date: string, from: number, newStart: string) {
    const s = effStruct(date);
    const slot = s.slots[from];
    if (!slot) return;
    const duration = toMin(slot.end) - toMin(slot.start);
    let startC = toMin(newStart);
    let endC = startC + duration;
    if (endC > DAY_MAX) {
      endC = DAY_MAX;
      startC = endC - duration;
    }
    if (startC < 0) return;

    const overlaps = s.slots.some((other, i) => {
      if (i === from) return false;
      return startC < toMin(other.end) && endC > toMin(other.start);
    });
    if (overlaps) {
      flash("다른 시간대와 겹쳐서 이동할 수 없습니다");
      return;
    }

    const updatedSlots = s.slots.map((sl, i) =>
      i === from ? { ...sl, start: fromMin(startC), end: fromMin(endC) } : sl,
    );
    commitSlotTimes(date, s.rooms, updatedSlots);
  }

  /** drag a time block's label onto ANOTHER block (not just an empty gap)
   *  — swaps the two blocks' times, each keeping its own duration. This is
   *  what makes every row a valid drop target, matching room-header drag
   *  (any other header always works) instead of relying on empty gaps,
   *  which rarely exist in a fully-booked real schedule. */
  function swapBlock(date: string, from: number, to: number) {
    const s = effStruct(date);
    if (from === to || from < 0 || to < 0 || from >= s.slots.length || to >= s.slots.length)
      return;
    const a = s.slots[from];
    const b = s.slots[to];
    const durA = toMin(a.end) - toMin(a.start);
    const durB = toMin(b.end) - toMin(b.start);
    const newAEnd = toMin(b.start) + durA;
    const newBEnd = toMin(a.start) + durB;
    if (newAEnd > DAY_MAX || newBEnd > DAY_MAX) {
      flash("다른 시간대와 겹쳐서 이동할 수 없습니다");
      return;
    }
    const newA: SlotDef = { ...a, start: b.start, end: fromMin(newAEnd) };
    const newB: SlotDef = { ...b, start: a.start, end: fromMin(newBEnd) };

    const others = s.slots.filter((_, i) => i !== from && i !== to);
    const overlapsOthers = (slot: SlotDef) =>
      others.some((o) => toMin(slot.start) < toMin(o.end) && toMin(slot.end) > toMin(o.start));
    if (overlapsOthers(newA) || overlapsOthers(newB)) {
      flash("다른 시간대와 겹쳐서 이동할 수 없습니다");
      return;
    }

    const updatedSlots = s.slots.map((sl, i) => (i === from ? newA : i === to ? newB : sl));
    commitSlotTimes(date, s.rooms, updatedSlots);
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

  // ← / → move to the previous / next week (only where the ‹ › week nav shows)
  useEffect(() => {
    if (initialWeekKey != null || dayOnly) return;
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
      setWeekKey(iso(addDays(week.start, e.key === "ArrowLeft" ? -7 : 7)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [initialWeekKey, dayOnly, weekKey, week.start]);

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
      <div className="overflow-x-auto scroll-thin">
        <div className="flex flex-nowrap items-center gap-2 py-0.5">
          {viewToggle}
          {!embedded && !dayOnly && (
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setWeekKey(iso(addDays(week.start, -7)))}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-2 hover:bg-paper-2"
              >
                ‹
              </button>
              <span className="min-w-[168px] shrink-0 whitespace-nowrap text-center text-[13px] font-medium tabular-nums text-ink-2">
                {iso(week.start)} ~ {iso(week.end)}
              </span>
              <button
                type="button"
                onClick={() => setWeekKey(iso(addDays(week.start, 7)))}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-ink-2 hover:bg-paper-2"
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
                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                paint
                  ? "border-clay bg-clay text-paper"
                  : "border-line-strong text-ink-2 hover:bg-paper-2",
              )}
            >
              {paint ? "비활성 지정 중 — 드래그, 또는 행/열 이름 클릭" : "비활성 지정"}
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={() => undo()}
              disabled={undoStack.length === 0}
              title="이전 (⌘/Ctrl+Z)"
              className="shrink-0 whitespace-nowrap rounded-full border border-line-strong px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:bg-paper-2 disabled:opacity-40"
            >
              ↶ 이전
            </button>
          )}

          <div className="shrink-0">
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
      </div>

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
                        // 비수업 칸·비활성 지정된 칸은 관리자만 수정 가능
                        const cur = cells.get(keyOf(date, room, slot));
                        if ((cur?.kind === "block" || cur?.active === false) && !isAdmin) return;
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
                onReorderRoom={(from, to) => reorderRoom(date, from, to)}
                onMoveBlock={(from, newStart) => moveBlock(date, from, newStart)}
                onSwapBlock={(from, to) => swapBlock(date, from, to)}
                onResetStruct={() => resetStruct(date)}
                paintMode={isAdmin && !readOnly && paint}
                onPaint={(targets, value) => paintCells(targets, value, date)}
                dnd={
                  readOnly || paint
                    ? undefined
                    : {
                        canDrag: canDragCell,
                        isSource: (room, slot) =>
                          dragFrom?.date === date &&
                          dragFrom.room === room &&
                          dragFrom.slot === slot,
                        isOver: (room, slot) =>
                          !!dragFrom &&
                          dragOver?.date === date &&
                          dragOver.room === room &&
                          dragOver.slot === slot,
                        onDragStart: (room, slot) => setDragFrom({ date, room, slot }),
                        onDragOver: (room, slot) => setDragOver({ date, room, slot }),
                        onDrop: (room, slot) => {
                          if (dragFrom) moveCell(dragFrom, { date, room, slot });
                        },
                        onDragEnd: () => {
                          setDragFrom(null);
                          setDragOver(null);
                        },
                      }
                }
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
  onReorderRoom,
  onMoveBlock,
  onSwapBlock,
  onResetStruct,
  paintMode,
  onPaint,
  dnd,
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
  dnd?: DnDCtl;
  onMemoChange: (hhmm: string, line: MemoLine | null) => void;
  onAddBlock: () => void;
  onInsertBlock: (start: string, end: string) => void;
  onEditBlock: (i: number, patch: Partial<SlotDef>) => void;
  onDeleteBlock: (i: number) => void;
  onAddRoom: () => void;
  onEditRoom: (i: number, name: string) => void;
  onDeleteRoom: (i: number) => void;
  onReorderRoom: (from: number, to: number) => void;
  onMoveBlock: (from: number, newStart: string) => void;
  onSwapBlock: (from: number, to: number) => void;
  onResetStruct: () => void;
  paintMode: boolean;
  onPaint: (
    targets: { room: string; slot: number }[],
    value: "deactivate" | "activate",
  ) => void;
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
        dnd={dnd}
        structEdit={
          canStruct
            ? {
                onRenameRoom: onEditRoom,
                onDeleteRoom,
                onAddRoom,
                onReorderRoom,
                onRetimeBlock: onEditBlock,
                onDeleteBlock,
                onAddBlock,
                onInsertBlock,
                onMoveBlock,
                onSwapBlock,
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
                {m === "pairing" ? "학생(교사)" : "비활성"}
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
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="비활성 메모 (선택) — 예) 6:20-8 성대k 김"
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
                    "repeating-linear-gradient(135deg, var(--color-paper-2) 0 4px, #c7bba6 4px 5px)",
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
