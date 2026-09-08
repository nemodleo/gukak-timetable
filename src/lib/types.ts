export type WeekStart = "mon" | "sun";

/** one lesson block on the day timeline. duration is derived from start/end. */
export interface SlotDef {
  start: string; // "HH:MM" 24h
  end: string; // "HH:MM"
  label?: string; // optional display override (default: derived 12h range)
}

export interface Settings {
  school_name: string;
  year: number;
  month: number; // 1-12
  week_start: WeekStart;
  rooms: string[];
  time_slots_weekday: SlotDef[];
  time_slots_weekend: SlotDef[];
}

export interface Pairing {
  id: string;
  ym: string; // "YYYY-MM" — the roster/target month this row belongs to
  student_name: string;
  grade: string; // "1" | "2" | "3" | "1,2" | ...
  teacher_name: string;
  target_hours: number | null;
  label: string; // "학생 (교사T)"
  sort_order: number;
  active: boolean;
}

/** 셀 상태: 비어있음(행 없음) · 학생(교사) 배정 · 비수업.
 *  비수업(block)은 선택적으로 메모(text)와 배경색(color)을 가질 수 있고,
 *  관리자만 만들거나 수정할 수 있다. */
export type CellKind = "pairing" | "block";

/** 비수업 칸의 선택적 배경 tint (기본 회색은 색 없음으로 표현). */
export type CellColor = "y" | "r" | "g" | "b";

export interface Cell {
  id: string;
  date: string; // ISO yyyy-mm-dd
  room: string;
  slot_index: number;
  kind: CellKind;
  pairing_id: string | null;
  text: string | null;
  color: CellColor | null;
}

/** ruled memo column — one line per 30-min mark, keyed "HH:MM" */
export type MemoSize = "s" | "m" | "l";
export interface MemoLine {
  text: string;
  red?: boolean;
  size?: MemoSize;
}
export interface DayMemo {
  date: string;
  lines: Record<string, MemoLine>;
}

/** per-date override of the grid shape. null field => fall back to Settings. */
export interface DayConfig {
  date: string;
  rooms: string[] | null;
  slots: SlotDef[] | null;
}

export interface SeedPayload {
  settings: Settings;
  pairings: Array<Omit<Pairing, "id" | "active"> & { active?: boolean }>;
  cells: Array<{
    date: string;
    room: string;
    slot_index: number;
    kind: CellKind;
    label: string | null;
    text: string | null;
    color?: CellColor | null;
  }>;
  memos: DayMemo[];
  day_configs?: DayConfig[];
}

export const DEFAULT_SETTINGS: Settings = {
  school_name: "국립국악고등학교",
  year: 2026,
  month: 7,
  week_start: "mon",
  rooms: ["I", "II", "III", "大", "中", "우"],
  // contiguous 2h blocks (last = 1h). admin can retime per school / per day.
  time_slots_weekday: [
    { start: "06:00", end: "08:00" },
    { start: "08:00", end: "10:00" },
    { start: "10:00", end: "12:00" },
    { start: "12:00", end: "14:00" },
    { start: "14:00", end: "16:00" },
    { start: "16:00", end: "18:00" },
    { start: "18:00", end: "20:00" },
    { start: "20:00", end: "22:00" },
    { start: "22:00", end: "23:00" },
  ],
  time_slots_weekend: [
    { start: "05:00", end: "07:00" },
    { start: "07:00", end: "09:00" },
    { start: "09:00", end: "11:00" },
    { start: "11:00", end: "13:00" },
    { start: "13:00", end: "15:00" },
    { start: "15:00", end: "17:00" },
    { start: "17:00", end: "18:00" },
  ],
};
