"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "./PasswordInput";
import { CONTACT_EMAIL } from "@/lib/contact";

/** Shown in place of any timetable page when nobody is logged in. One
 *  password box: the role comes from which password it is (열람 / 강사 / 관리자). */
export function LoginGate({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-sm rounded-lg border bg-paper px-6 py-8">
      <h1 className="font-serif text-xl font-medium">로그인</h1>
      <p className="mt-1 break-keep text-[13px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
        시간표에는 학생 이름이 있어 로그인한 사람만 볼 수 있습니다. 학생·학부모는{" "}
        <strong>열람 비밀번호</strong>, 강사·관리자는 각자의 비밀번호를 입력하세요.
      </p>
      {!configured && (
        <p className="mt-3 rounded border border-clay-soft bg-clay-wash px-3 py-2 text-[12px] text-ink-2">
          비밀번호 환경변수(<code>VIEWER_PASSWORD</code> 등)가 설정되지 않았습니다.
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
          if (res.ok) {
            setPw("");
            router.refresh();
          } else {
            setErr(j.error ?? "로그인 실패");
          }
        }}
      >
        <label htmlFor="login-pw" className="mb-1.5 block text-[12px] font-semibold tracking-wide text-ink-2">
          비밀번호
        </label>
        <PasswordInput
          id="login-pw"
          autoFocus
          value={pw}
          onChange={setPw}
          className="w-full rounded-md border border-line-strong bg-paper px-3 py-2 text-sm outline-none focus:border-clay"
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
      <p className="mt-4 break-keep text-[13px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
        비밀번호가 없거나 시간표에 관해 물어볼 것이 있으면{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="underline decoration-clay underline-offset-4"
        >
          {CONTACT_EMAIL}
        </a>{" "}
        으로 메일을 주세요. 여러 번 틀리면 잠시 잠깁니다.
      </p>
    </div>
  );
}
