/** grade -> visual treatment. Mirrors the xlsx conditional formatting:
 *  1 = yellow, 2 = red, 3 = green, label/grade containing "," = blue (보강). */
import type { CellColor } from "./types";

export type GradeKey = "g1" | "g2" | "g3" | "gm" | "none";

export function gradeKey(grade: string | null | undefined, label?: string): GradeKey {
  const g = (grade ?? "").trim();
  if (g.includes(",") || (label ?? "").includes(",")) return "gm";
  if (g === "1") return "g1";
  if (g === "2") return "g2";
  if (g === "3") return "g3";
  return "none";
}

/** soft wash used for schedule cells */
export const cellBg: Record<GradeKey, string> = {
  g1: "var(--color-g1)",
  g2: "var(--color-g2)",
  g3: "var(--color-g3)",
  gm: "var(--color-gm)",
  none: "transparent",
};

/** exact legacy hex used for small stat badges / legends */
export const badgeBg: Record<GradeKey, string> = {
  g1: "var(--color-g1-badge)",
  g2: "var(--color-g2-badge)",
  g3: "var(--color-g3-badge)",
  gm: "var(--color-gm-badge)",
  none: "var(--color-paper-2)",
};

export const gradeLabel: Record<GradeKey, string> = {
  g1: "1학년",
  g2: "2학년",
  g3: "3학년",
  gm: "보강 · 합반",
  none: "기타",
};

/* ---- 비활성(block) 칸 배경 tint (색 미지정 시 기본은 사선 해칭) ----
 * 배정(pairing) 칸의 옅은 wash보다 한 단계 진한 -badge 톤을 써서, 같은
 * 색이어도 비활성 칸이 또렷이 구별되게 한다. */
export const blockCellBg: Record<CellColor, string> = {
  y: "var(--color-g1-badge)",
  r: "var(--color-g2-badge)",
  g: "var(--color-g3-badge)",
  b: "var(--color-gm-badge)",
};

export const CELL_COLOR_OPTIONS: { key: CellColor; label: string }[] = [
  { key: "y", label: "노랑" },
  { key: "r", label: "빨강" },
  { key: "g", label: "초록" },
  { key: "b", label: "파랑" },
];
