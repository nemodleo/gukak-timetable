/** grade -> visual treatment. Mirrors the xlsx conditional formatting:
 *  1 = yellow, 2 = red, 3 = green, label/grade containing "," = blue (보강). */
import type { CSSProperties } from "react";
import {
  DEFAULT_GRADE_COLORS,
  DEFAULT_INACTIVE_BG_COLOR,
  DEFAULT_INACTIVE_PATTERN,
  DEFAULT_INACTIVE_PATTERN_COLOR,
  type CellColor,
  type GradeColors,
  type InactivePattern,
} from "./types";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v);
}

/** validate a (possibly partial/malformed) grade_colors value from the DB
 *  or a client request, falling back to the default per-slot on any miss. */
export function normalizeGradeColors(v: unknown): GradeColors {
  const o = (v ?? {}) as Partial<Record<keyof GradeColors, unknown>>;
  return {
    g1: isHexColor(o.g1) ? o.g1 : DEFAULT_GRADE_COLORS.g1,
    g2: isHexColor(o.g2) ? o.g2 : DEFAULT_GRADE_COLORS.g2,
    g3: isHexColor(o.g3) ? o.g3 : DEFAULT_GRADE_COLORS.g3,
    gm: isHexColor(o.gm) ? o.gm : DEFAULT_GRADE_COLORS.gm,
  };
}

export function normalizeInactiveBgColor(v: unknown): string {
  return isHexColor(v) ? v : DEFAULT_INACTIVE_BG_COLOR;
}

export function normalizeInactivePatternColor(v: unknown): string {
  return isHexColor(v) ? v : DEFAULT_INACTIVE_PATTERN_COLOR;
}

const INACTIVE_PATTERN_SET = new Set<InactivePattern>(["hatch", "cross", "dots", "solid"]);
export function normalizeInactivePattern(v: unknown): InactivePattern {
  return typeof v === "string" && INACTIVE_PATTERN_SET.has(v as InactivePattern)
    ? (v as InactivePattern)
    : DEFAULT_INACTIVE_PATTERN;
}

export const INACTIVE_PATTERN_OPTIONS: { key: InactivePattern; label: string }[] = [
  { key: "hatch", label: "사선" },
  { key: "cross", label: "격자" },
  { key: "dots", label: "점" },
  { key: "solid", label: "단색" },
];

/** 비활성 칸의 배경 무늬 — 배경색(무늬 사이 여백)과 패턴색(선·점, solid일
 *  땐 칸을 채우는 색) 두 색과 패턴으로 CSSProperties를 만든다. 실제 칸
 *  렌더링(Cell.tsx)과 설정 화면의 미리보기가 같은 함수를 써서 항상 똑같이
 *  보인다. */
export function inactiveBackgroundStyle(
  pattern: InactivePattern,
  bgColor: string,
  patternColor: string,
): CSSProperties {
  switch (pattern) {
    case "solid":
      return { backgroundColor: patternColor };
    case "dots":
      return {
        backgroundColor: bgColor,
        backgroundImage: `radial-gradient(${patternColor} 1.3px, transparent 1.3px)`,
        backgroundSize: "7px 7px",
      };
    case "cross":
      return {
        backgroundColor: bgColor,
        backgroundImage: `repeating-linear-gradient(45deg, transparent 0 5px, ${patternColor} 5px 6px), repeating-linear-gradient(135deg, transparent 0 5px, ${patternColor} 5px 6px)`,
      };
    case "hatch":
    default:
      return {
        backgroundImage: `repeating-linear-gradient(135deg, ${bgColor} 0 5px, ${patternColor} 5px 6px)`,
      };
  }
}

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
