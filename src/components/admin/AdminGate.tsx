"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "../PasswordInput";

export function AdminGate({
  isAdmin,
  configured,
  children,
}: {
  isAdmin: boolean;
  configured: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAdmin) return <>{children}</>;

  return (
    <div className="mx-auto max-w-sm rounded-lg border bg-paper px-6 py-8">
      <h1 className="font-serif text-xl font-medium">관리자 로그인</h1>
      <p className="mt-1 text-[13px] text-ink-3">
        관리자 페이지입니다. <strong>관리자</strong> 비밀번호로 로그인하세요.
      </p>
      {!configured && (
        <p className="mt-3 rounded border border-clay-soft bg-clay-wash px-3 py-2 text-[12px] text-ink-2">
          <code>ADMIN_PASSWORD</code> 환경변수가 설정되지 않았습니다.
        </p>
      )}
      <form
        className="mt-5 space-y-3"
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
          if (res.ok && j.role === "admin") {
            router.refresh();
          } else if (res.ok) {
            setErr("관리자 비밀번호가 아닙니다.");
          } else {
            setErr(j.error ?? "로그인 실패");
          }
        }}
      >
        <PasswordInput
          autoFocus
          value={pw}
          onChange={setPw}
          className="w-full rounded-md border border-line-strong bg-paper px-3 py-2 text-sm outline-none focus:border-clay"
          placeholder="비밀번호"
        />
        {err && <p className="text-[12px] text-over">{err}</p>}
        <button
          type="submit"
          disabled={busy || !pw}
          className="w-full rounded-md bg-ink px-3 py-2 text-sm text-paper disabled:opacity-50"
        >
          {busy ? "확인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
