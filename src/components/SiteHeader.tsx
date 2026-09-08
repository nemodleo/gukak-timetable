"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { PasswordInput } from "./PasswordInput";

const NAV = [
  { href: "/", label: "월간" },
  { href: "/stats", label: "통계", auth: true },
];

export function SiteHeader({
  schoolName,
  year,
  month,
  role,
}: {
  schoolName: string;
  year: number;
  month: number;
  role: "admin" | "instructor" | null;
}) {
  const pathname = usePathname();
  const pill =
    "rounded-full px-2.5 py-1.5 text-[12px] transition-colors sm:px-3.5 sm:text-[13px]";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-sm no-print">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-4 py-3.5 sm:gap-6 sm:px-8">
        <Link href="/" className="group flex shrink-0 items-baseline gap-3">
          <span className="font-serif text-[17px] font-medium tracking-tight text-ink">
            시간표
          </span>
          <span className="hidden text-xs text-ink-3 sm:inline">
            {schoolName} · 강사 · 강의실
          </span>
        </Link>

        <nav className="flex min-w-0 items-center gap-0.5 sm:gap-1">
          <span className="mr-2 hidden text-xs tabular-nums text-ink-3 sm:inline">
            {year}. {String(month).padStart(2, "0")}
          </span>
          {NAV.filter((n) => !n.auth || role).map((n) => {
            const active =
              n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  pill,
                  active ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2",
                )}
              >
                {n.label}
              </Link>
            );
          })}

          <span className="mx-0.5 h-4 w-px bg-line sm:mx-1" />

          <AuthControl role={role} adminActive={pathname.startsWith("/admin")} />
        </nav>
      </div>
    </header>
  );
}

function AuthControl({
  role,
  adminActive,
}: {
  role: "admin" | "instructor" | null;
  adminActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "instructor" | "admin">(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pill =
    "rounded-full px-2.5 py-1.5 text-[12px] transition-colors sm:px-3.5 sm:text-[13px]";

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  if (role) {
    return (
      <div className="flex items-center gap-1 sm:gap-1.5">
        {role === "admin" && !adminActive && (
          <Link
            href="/admin"
            className={clsx(pill, "hidden text-ink-2 hover:bg-paper-2 sm:inline-flex")}
          >
            관리자 페이지
          </Link>
        )}
        <span className="rounded-full bg-paper-2 px-2 py-1 text-[11px] font-medium text-ink-2 sm:px-2.5 sm:text-[12px]">
          {role === "admin" ? "관리자" : "강사"}
        </span>
        <button
          type="button"
          onClick={logout}
          className="rounded-full border border-line-strong px-2.5 py-1.5 text-[11px] text-ink-2 hover:bg-paper-2 sm:px-3 sm:text-[12px]"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-1">
      {(["instructor", "admin"] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => {
            setErr(null);
            setPw("");
            setOpen((o) => (o === k ? null : k));
          }}
          className={clsx(pill, open === k ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2")}
        >
          {k === "instructor" ? "강사" : "관리자"}
        </button>
      ))}

      {open && (
        <form
          className="absolute right-0 top-full z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg border bg-paper p-3 shadow-lg"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ password: pw }),
            });
            const j = await res.json().catch(() => ({}));
            setBusy(false);
            if (res.ok) {
              setOpen(null);
              setPw("");
              if (j.role === "admin" && open === "admin") router.push("/admin");
              router.refresh();
            } else {
              setErr(j.error ?? "로그인 실패");
            }
          }}
        >
          <p className="mb-2 text-[11.5px] leading-snug text-ink-3">
            {open === "admin"
              ? "관리자 비밀번호를 입력하면 관리자 페이지로 이동합니다."
              : "강사 비밀번호를 입력하면 시간표를 편집할 수 있습니다."}
          </p>
          <PasswordInput
            autoFocus
            value={pw}
            onChange={setPw}
            placeholder={open === "admin" ? "관리자 비밀번호" : "강사 비밀번호"}
            className="w-full rounded-md border border-line-strong bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-clay"
          />
          {err && <p className="mt-1 text-[11px] text-over">{err}</p>}
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="rounded-md border border-line-strong px-2.5 py-1 text-[12px] text-ink-2"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={busy || !pw}
              className="rounded-md bg-ink px-3 py-1 text-[12px] text-paper disabled:opacity-50"
            >
              {busy ? "…" : "로그인"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
