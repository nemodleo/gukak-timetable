"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Cell, DayConfig, DayMemo, MemoLine, Pairing, Settings } from "@/lib/types";
import {
  addDays,
  iso,
  parseIso,
  roomsForDate,
  slotsForDate,
  startOfWeekKey,
  weekFromKey,
} from "@/lib/schedule";
import { cellRow, hasCellContent, keyOf } from "@/lib/cellIndex";
import { putJson, saveDayApprovals, sendJson, withApproval } from "@/lib/api";
import {
  addRoom,
  appendBlock,
  deleteBlock,
  deleteRoom,
  insertBlock,
  moveBlock,
  renameRoom,
  reorderRoom,
  retimeBlock,
  swapBlock,
  type Struct,
  type StructChange,
} from "@/lib/structOps";
import {
  EMPTY_MEMO_LINES,
  type PaintTarget,
  type PaintValue,
  type StructEdit,
} from "../DayGrid";
import { DayCapture } from "../DayCapture";
import { CellEditor, type CellDraft, type CellEdit } from "./CellEditor";
import { EditableDay, type SaveStatus } from "./EditableDay";

/** one cell write: where, what it was (kept for undo), what it becomes (null = empty) */
type CellChange = CellDraft & { before: Cell | null; after: Cell | null };
/** 되돌리기 한 단계 = 한 번의 편집(칸 여러 개일 수 있음)에서 바뀐 칸들의 이전 상태 */
type UndoOp = CellDraft & { before: Cell | null };

export function ScheduleEditor({
  settings,
  pairings,
  initialCells,
  initialMemos,
  initialConfigs,
  approvedDates,
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
  /** 관리자가 승인(오픈)한 날짜 — 없는 날짜는 기본 잠금(강사 입력 불가, 관리자는 무관) */
  approvedDates: string[];
  year: number;
  month: number;
  /** lock the editor to a specific week (defaults to first week of year/month) */
  initialWeekKey?: string;
  /** render only this one day (for /day) */
  dayOnly?: string;
  /** admin unlocks grid structure editing (rooms/blocks) + the drag "비활성 지정" tool */
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
  const [structState, setStructState] = useState<Map<string, SaveStatus>>(new Map());
  const [draft, setDraft] = useState<CellDraft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paint, setPaint] = useState(false);
  const [approved, setApproved] = useState<Set<string>>(() => new Set(approvedDates));
  const [undoStack, setUndoStack] = useState<UndoOp[][]>([]);
  const [dragFrom, setDragFrom] = useState<CellDraft | null>(null);
  const [dragOver, setDragOver] = useState<CellDraft | null>(null);
  const undoStackRef = useRef<UndoOp[][]>([]);
  const doUndoRef = useRef<() => void>(() => {});
  const loaded = useRef<Set<string>>(new Set([firstWeekKey]));
  const memoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const structTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const structSaving = useRef<Set<string>>(new Set());
  const structAgain = useRef<Set<string>>(new Set());
  const runStructSaveRef = useRef<(date: string) => void>(() => {});

  const setSState = (date: string, v: SaveStatus | undefined) =>
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

  /* ---------------- 날짜 승인 ---------------- */
  /** 강사 입력 잠금 여부 — 관리자는 무관, 승인 안 된 날짜(기본값)만 잠김 */
  const isDayLocked = (date: string) => !isAdmin && !approved.has(date);

  /** 관리자 전용 — 이 날짜 하나를 승인/잠금 토글(월간 화면 드래그와 같은 API) */
  async function toggleDayApproval(date: string) {
    const next = !approved.has(date);
    const err = await saveDayApprovals([date], next);
    if (err) return flash(`저장 실패: ${err}`);
    setApproved((prev) => withApproval(prev, [date], next));
  }

  /* ---------------- data loading ---------------- */
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
  /** PUT the rows, then mirror them locally. null on success, else the error. */
  async function writeCells(changes: CellChange[]): Promise<string | null> {
    const err = await putJson(
      "/api/schedule",
      changes.map((c) => cellRow(c.date, c.room, c.slot, c.after)),
    );
    if (err) return err;
    setCells((prev) => {
      const next = new Map(prev);
      for (const c of changes) {
        const k = keyOf(c.date, c.room, c.slot);
        if (c.after) next.set(k, c.after);
        else next.delete(k);
      }
      return next;
    });
    return null;
  }

  /** a user edit: write it, report a failure, and record it as one undo step */
  async function commitCells(changes: CellChange[], failLabel: string): Promise<boolean> {
    const err = await writeCells(changes);
    if (err) {
      flash(`${failLabel}: ${err}`);
      return false;
    }
    const ops = changes.map((c) => ({ date: c.date, room: c.room, slot: c.slot, before: c.before }));
    setUndoStack((s) => [...s.slice(-49), ops]);
    return true;
  }

  async function undo() {
    const ops = undoStackRef.current.at(-1);
    if (!ops?.length) return;
    setUndoStack((s) => s.slice(0, -1));
    const err = await writeCells(ops.map((o) => ({ ...o, after: o.before })));
    flash(err ? `되돌리기 실패: ${err}` : "되돌렸습니다");
  }

  async function saveCell(d: CellDraft, edit: CellEdit) {
    const k = keyOf(d.date, d.room, d.slot);
    const before = cells.get(k) ?? null;
    const empty = !edit.kind || (edit.kind === "pairing" && !edit.pairing_id);
    const after: Cell | null = empty
      ? null
      : {
          id: before?.id ?? `tmp-${k}`,
          date: d.date,
          room: d.room,
          slot_index: d.slot,
          kind: edit.kind!,
          pairing_id: edit.kind === "pairing" ? edit.pairing_id ?? null : null,
          text: edit.kind === "block" ? edit.text ?? null : null,
          color: edit.kind === "block" ? edit.color ?? null : null,
          // 내용 편집은 비활성 지정 상태를 건드리지 않는다(기존 상태 유지)
          active: before?.active ?? true,
        };
    if (await commitCells([{ ...d, before, after }], "저장 실패")) setDraft(null);
  }

  // 칸 드래그 이동 — 배정(강사+관리자)·비활성(관리자만) 칸을 다른 시간/칸으로.
  // 이동 = 대상 칸에 그대로 쓰고 원래 칸을 비움; 시수는 어디서든 slotHours(date, slot_index)로
  // 그때그때 계산되므로 칸만 옮기면 통계·포화도가 저절로 다시 맞습니다.
  function canDragCell(cell: Cell | undefined): boolean {
    if (readOnly || !cell) return false;
    if (isDayLocked(cell.date)) return false;
    return cell.kind === "block" || cell.active === false ? isAdmin : true;
  }

  async function moveCell(from: CellDraft, to: CellDraft) {
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
    const moved = await commitCells(
      [
        {
          ...to,
          before: destBefore,
          after: { ...src, date: to.date, room: to.room, slot_index: to.slot },
        },
        { ...from, before: src, after: null },
      ],
      "이동 실패",
    );
    if (moved) flash("이동했습니다");
  }

  /** 비활성 지정/해제 — 내용(배정·텍스트)은 그대로 두고 active만 바꾼다.
   *  기존에 아무 내용도 없던 칸을 비활성으로 지정할 땐 잠금 표시용 빈 block
   *  칸을 만들고, 그런 칸을 다시 활성화할 땐(내용이 없으므로) 그냥 지운다. */
  async function paintCells(targets: PaintTarget[], value: PaintValue, date: string) {
    const changes: CellChange[] = [];
    for (const t of targets) {
      const k = keyOf(date, t.room, t.slot);
      const before = cells.get(k) ?? null;
      let after: Cell | null;
      if (before && hasCellContent(before)) {
        after = { ...before, active: value === "activate" };
      } else if (value === "activate") {
        if (!before) continue; // 없던 걸 활성화할 것도 없음
        after = null; // 내용 없던 잠금칸 -> 완전히 비움
      } else {
        after = {
          id: before?.id ?? `tmp-${k}`,
          date,
          room: t.room,
          slot_index: t.slot,
          kind: "block",
          pairing_id: null,
          text: null,
          color: null,
          active: false,
        };
      }
      changes.push({ date, room: t.room, slot: t.slot, before, after });
    }
    if (changes.length) await commitCells(changes, "저장 실패");
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
        setTimeout(() => void putJson("/api/memos", { date, lines: cur }), 450),
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

  /** run one structural edit on a day: refuse with its message, or apply it
   *  locally (moving that day's cells along) and queue the auto-save */
  function applyStruct(date: string, change: (s: Struct) => StructChange) {
    const r = change(effStruct(date));
    if (!r) return;
    if ("error" in r) return flash(r.error);
    setStruct((prev) => new Map(prev).set(date, r.struct));
    const remap = r.remap;
    if (remap)
      setCells((prev) => {
        const m = new Map(prev);
        remap(m);
        return m;
      });
    scheduleStructSave(date);
  }

  const structEditFor = (date: string): StructEdit => ({
    onAddBlock: () => applyStruct(date, appendBlock),
    onInsertBlock: (start, end) => applyStruct(date, (s) => insertBlock(s, date, start, end)),
    onRetimeBlock: (i, patch) => applyStruct(date, (s) => retimeBlock(s, i, patch)),
    onDeleteBlock: (i) => applyStruct(date, (s) => deleteBlock(s, date, i)),
    onMoveBlock: (from, start) => applyStruct(date, (s) => moveBlock(s, date, from, start)),
    onSwapBlock: (from, to) => applyStruct(date, (s) => swapBlock(s, date, from, to)),
    onAddRoom: () => applyStruct(date, addRoom),
    onRenameRoom: (i, name) => applyStruct(date, (s) => renameRoom(s, date, i, name)),
    onDeleteRoom: (i) => applyStruct(date, (s) => deleteRoom(s, date, i)),
    onReorderRoom: (from, to) => applyStruct(date, (s) => reorderRoom(s, from, to)),
  });

  /** save a day's grid override, then rewrite its cells (slot_index may have
   *  been renumbered, so clear the day and write back what's left) */
  async function doStructSave(date: string): Promise<boolean> {
    const s = effStruct(date);
    const roomSet = new Set(s.rooms);
    const rows = [...cells.values()]
      .filter((c) => c.date === date && roomSet.has(c.room) && c.slot_index < s.slots.length)
      .map((c) => cellRow(c.date, c.room, c.slot_index, c));
    let err = await putJson("/api/day-config", { date, rooms: s.rooms, slots: s.slots });
    if (!err) err = await sendJson(`/api/schedule?date=${date}`, "DELETE");
    if (!err && rows.length) err = await putJson("/api/schedule", rows);
    if (err) {
      flash(`구조 저장 실패: ${err}`);
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
    if (await sendJson(`/api/day-config?date=${date}`, "DELETE")) return flash("되돌리기 실패");
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
            const locked = isDayLocked(date);
            return (
              <EditableDay
                key={date}
                date={date}
                wide={Boolean(dayOnly)}
                readOnly={readOnly}
                locked={locked}
                isApproved={approved.has(date)}
                isAdmin={isAdmin}
                onToggleApproval={isAdmin ? () => toggleDayApproval(date) : undefined}
                struct={effStruct(date)}
                structEdit={isAdmin && !readOnly ? structEditFor(date) : undefined}
                hasOverride={serverCfg.has(date)}
                saveState={structState.get(date)}
                onResetStruct={() => resetStruct(date)}
                cells={cells}
                pairings={pairings}
                memoLines={memos.get(date) ?? EMPTY_MEMO_LINES}
                onCellClick={
                  readOnly || locked
                    ? undefined
                    : (room, slot) => {
                        // 비수업 칸·비활성 지정된 칸은 관리자만 수정 가능
                        const cur = cells.get(keyOf(date, room, slot));
                        if ((cur?.kind === "block" || cur?.active === false) && !isAdmin) return;
                        setDraft({ date, room, slot });
                      }
                }
                onMemoChange={locked ? undefined : (hhmm, line) => changeMemo(date, hhmm, line)}
                paintMode={isAdmin && !readOnly && paint}
                onPaint={(targets, value) => paintCells(targets, value, date)}
                dnd={
                  readOnly || paint || locked
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
          onSave={(edit) => saveCell(draft, edit)}
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
