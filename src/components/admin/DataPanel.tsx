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
        <SectionTitle sub="data/ 폴더의 2026년 1~9월 엑셀에서 추출한 월별 명단·목표시수·배정·회색(비수업) 칸·메모 전체를 DB에 적재합니다. 같은 칸은 덮어씁니다.">
          기본 데이터 가져오기
        </SectionTitle>
        <button
          type="button"
          disabled={busy}
          onClick={() => post()}
          className="rounded-md bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50"
        >
          {busy ? "가져오는 중…" : "2026년 전체 기본 데이터 가져오기"}
        </button>
      </section>

      <section>
        <SectionTitle sub="이전에 내보낸 백업(JSON)을 선택하면 그대로 복원합니다.">
          백업 파일 가져오기
        </SectionTitle>
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
      </section>

      <section>
        <SectionTitle sub="현재 DB의 모든 설정·명단·배정·메모를 JSON으로 저장합니다.">
          백업 내보내기
        </SectionTitle>
        <a
          href="/api/export"
          className="inline-block rounded-md border border-line-strong px-4 py-2 text-sm text-ink-2 hover:bg-paper-2"
        >
          백업 다운로드
        </a>
      </section>

      {msg && (
        <p className="rounded border bg-paper px-3 py-2 text-[12px] text-ink-2">{msg}</p>
      )}
    </div>
  );
}
