import type { Role } from "./auth";

/** the three role manuals, backed by docs/*.md (also rendered by GitHub). */
export const MANUAL_SLUGS = ["admin", "instructor", "student"] as const;
export type ManualSlug = (typeof MANUAL_SLUGS)[number];

export const MANUALS: Record<ManualSlug, { file: string; title: string; desc: string }> = {
  admin: {
    file: "admin-manual.md",
    title: "관리자 매뉴얼",
    desc: "시간표 담당 교사용 — 전 기능(로그인·권한, 칸 편집, 비활성 지정, 그리드 구조, 명단·목표시수·설정·데이터, 통계, 문제 해결).",
  },
  instructor: {
    file: "instructor-manual.md",
    title: "강사 매뉴얼",
    desc: "강사용 — 로그인, 보기/편집, 학생 배정·이동, 메모, 되돌리기, 이미지 저장, 통계 열람.",
  },
  student: {
    file: "student-manual.md",
    title: "학생 매뉴얼",
    desc: "로그인 없이 보는 학생용 — 월→주→일 보기, 색·빗금 의미, 내 시간표 이미지 저장.",
  },
};

/** 관리자 = 전체, 강사 = 강사·학생, 학생(비로그인) = 학생 매뉴얼만. */
export function visibleManuals(role: Role | null): ManualSlug[] {
  if (role === "admin") return ["admin", "instructor", "student"];
  if (role === "instructor") return ["instructor", "student"];
  return ["student"];
}
