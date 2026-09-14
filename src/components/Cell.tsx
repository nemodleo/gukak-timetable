"use client";

import clsx from "clsx";
import type { Cell as CellT, Pairing } from "@/lib/types";
import { blockCellBg, cellBg, gradeKey, inactiveBackgroundStyle } from "@/lib/colors";
import { useInactiveStyle } from "@/lib/inactiveStyleContext";

export function CellBody({
  cell,
  pairing,
  size = "sm",
}: {
  cell?: CellT;
  pairing?: Pairing;
  size?: "sm" | "lg";
}) {
  const inactiveStyle = useInactiveStyle();

  if (!cell) return <span className="text-line-strong">·</span>;

  if (cell.kind === "block") {
    // 비수업 기본 = 관리자 설정의 비활성 색·무늬. 색을 지정하면 그 단색이 대신
    // 깔림. 메모는 위에 표시.
    return (
      <span
        className={clsx(
          "flex h-full w-full items-center whitespace-pre-wrap px-1.5 py-1 leading-tight text-ink-2",
          size === "lg" ? "text-[12px]" : "text-[10.5px]",
        )}
        style={
          cell.color
            ? { background: blockCellBg[cell.color] }
            : inactiveBackgroundStyle(inactiveStyle.pattern, inactiveStyle.color)
        }
      >
        {cell.text}
      </span>
    );
  }

  if (cell.kind === "pairing" && pairing) {
    // 비활성 지정 = 배정 내용은 그대로 두고 관리자가 고른 비활성 색·무늬만
    // 덮는다(강사 입력만 막힘, 통계엔 그대로 포함).
    const inactive = cell.active === false;
    const gk = gradeKey(pairing.grade, pairing.label);
    return (
      <span
        className={clsx(
          "flex h-full w-full flex-col justify-center rounded-[3px] px-1.5 py-1 leading-tight",
          size === "lg" ? "text-[13px]" : "text-[11.5px]",
        )}
        style={
          inactive
            ? inactiveBackgroundStyle(inactiveStyle.pattern, inactiveStyle.color)
            : { background: cellBg[gk] }
        }
      >
        <span className={clsx("font-medium text-ink", inactive && "opacity-70")}>
          {pairing.student_name}
        </span>
        {pairing.teacher_name && (
          <span className="text-[0.85em] text-ink-2">({pairing.teacher_name})</span>
        )}
      </span>
    );
  }

  return <span className="text-line-strong">·</span>;
}
