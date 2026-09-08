"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionTitle } from "../ui";

export function DataPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(body?: unknown) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/seed", {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg(`완료: ${JSON.stringify(j.report ?? j)}`);
      router.refresh();
    } else {
      setMsg(`오류: ${j.error ?? res.status}`);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <SectionTitle>시드·백업 파일 가져오기</SectionTitle>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="block text-[13px]"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const json = JSON.parse(await f.text());
              await post(json);
            } catch {
              setMsg("오류: JSON을 읽을 수 없습니다.");
            }
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <p className="mt-1.5 text-[12px] text-ink-3">
          make seed 로 만든 src/data/seed-2026.json 또는 내보낸 백업 JSON.
        </p>
      </section>

      <section>
        <SectionTitle>내보내기</SectionTitle>
        <a
          href="/api/export"
          className="inline-block rounded-md border border-line-strong px-4 py-2 text-sm text-ink-2 hover:bg-paper-2"
        >
          백업 다운로드
        </a>
      </section>

      <section>
        <SectionTitle>샘플 데이터 (데모용)</SectionTitle>
        <button
          type="button"
          disabled={busy}
          onClick={() => post()}
          className="rounded-md border border-line-strong px-4 py-2 text-sm text-ink-2 disabled:opacity-50"
        >
          {busy ? "가져오는 중…" : "앱에 포함된 샘플 데이터 가져오기"}
        </button>
        <p className="mt-1.5 text-[12px] text-ink-3">
          배포본에는 익명화된 샘플만 들어 있습니다. 실제 데이터는 위의 파일 가져오기를 사용하세요.
        </p>
      </section>

      {msg && (
        <p className="rounded border bg-paper px-3 py-2 text-[12px] text-ink-2">{msg}</p>
      )}
    </div>
  );
}
