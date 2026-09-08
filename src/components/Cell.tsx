import clsx from "clsx";
import type { Cell as CellT, Pairing } from "@/lib/types";
import { blockCellBg, cellBg, gradeKey } from "@/lib/colors";

const HATCH =
  "repeating-linear-gradient(135deg, var(--color-paper-2) 0 5px, #e2dcd2 5px 6px)";

export function CellBody({
  cell,
  pairing,
  size = "sm",
}: {
  cell?: CellT;
  pairing?: Pairing;
  size?: "sm" | "lg";
}) {
  if (!cell) return <span className="text-line-strong">·</span>;

  if (cell.kind === "block") {
    // 비수업 기본 = 사선 해칭. 색을 지정하면 그 단색이 대신 깔림. 메모는 위에 표시.
    return (
      <span
        className={clsx(
          "flex h-full w-full items-center whitespace-pre-wrap px-1.5 py-1 leading-tight text-ink-2",
          size === "lg" ? "text-[12px]" : "text-[10.5px]",
        )}
        style={
          cell.color
            ? { background: blockCellBg[cell.color] }
            : { backgroundImage: HATCH }
        }
      >
        {cell.text}
      </span>
    );
  }

  if (cell.kind === "pairing" && pairing) {
    const gk = gradeKey(pairing.grade, pairing.label);
    return (
      <span
        className={clsx(
          "flex h-full w-full flex-col justify-center rounded-[3px] px-1.5 py-1 leading-tight",
          size === "lg" ? "text-[13px]" : "text-[11.5px]",
        )}
        style={{ background: cellBg[gk] }}
      >
        <span className="font-medium text-ink">{pairing.student_name}</span>
        {pairing.teacher_name && (
          <span className="text-[0.85em] text-ink-2">{pairing.teacher_name}</span>
        )}
      </span>
    );
  }

  return <span className="text-line-strong">·</span>;
}
