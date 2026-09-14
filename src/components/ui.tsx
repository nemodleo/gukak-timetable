import Link from "next/link";
import clsx from "clsx";
import { badgeBg, gradeLabel, type GradeKey } from "@/lib/colors";

/** consistent page header used across all routes */
export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3 border-b border-line pb-4">
      <div className="min-w-0">
        {eyebrow && <p className="label-eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 font-serif text-[23px] font-medium tracking-tight text-ink sm:text-[27px]">
          {title}
        </h1>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2" data-no-capture>
          {actions}
        </div>
      )}
    </div>
  );
}

/** link-based prev / next stepper (month, week, day) */
export function StepNav({
  prev,
  next,
  label,
}: {
  prev: string;
  next: string;
  label?: React.ReactNode;
}) {
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-ink-2 transition-colors hover:bg-paper-2";
  return (
    <div className="flex items-center gap-1.5" data-no-capture>
      <Link href={prev} className={btn} aria-label="이전">
        ‹
      </Link>
      {label != null && (
        <span className="min-w-[7rem] text-center text-[13px] font-medium tabular-nums text-ink-2">
          {label}
        </span>
      )}
      <Link href={next} className={btn} aria-label="다음">
        ›
      </Link>
    </div>
  );
}

export function SectionTitle({
  children,
  sub,
  right,
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 className="font-serif text-[18px] font-medium text-ink">{children}</h2>
        {sub && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{sub}</p>}
      </div>
      {right && <div className="shrink-0 self-center">{right}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  tone?: "default" | "over";
}) {
  return (
    <div className="flex flex-col rounded-lg border bg-paper px-4 py-3">
      <div className="label-eyebrow">{label}</div>
      <div
        className={clsx(
          "mt-1.5 font-serif text-[22px] font-medium leading-none tabular-nums",
          tone === "over" ? "text-over" : "text-ink",
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 text-[13px] font-normal text-ink-3">{unit}</span>
        )}
      </div>
      {hint && (
        <div className="mt-2 truncate text-[11px] text-ink-3" title={typeof hint === "string" ? hint : undefined}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function Legend({ className }: { className?: string }) {
  const keys: GradeKey[] = ["g1", "g2", "g3", "gm"];
  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-2",
        className,
      )}
    >
      {keys.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-[3px] border"
            style={{ background: badgeBg[k] }}
          />
          {gradeLabel[k]}
        </span>
      ))}
    </div>
  );
}

/** 승인 대기(잠금) — 미니멀 아웃라인 자물쇠, 이모지 대신 */
export function LockIcon({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
    >
      {title && <title>{title}</title>}
      <rect
        x="4.25"
        y="9"
        width="11.5"
        height="8"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 승인됨(잠금 해제) — 열린 자물쇠 */
export function UnlockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <rect
        x="4.25"
        y="9"
        width="11.5"
        height="8"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6.5 9V6.5a3.5 3.5 0 0 1 6.85-1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
