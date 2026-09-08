"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionTitle } from "../ui";

export function DataPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "busy"; name: string }
    | { kind: "done"; text: string }
    | { kind: "error"; text: string }
  >({ kind: "idle" });

  async function importJson(body: unknown, name: string) {
    setStatus({ kind: "busy", name });
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        const r = j.report ?? {};
        setStatus({
          kind: "done",
          text: `가져오기 완료 · ${["pairings", "cells", "memos", "day_configs"]
            .filter((k) => r[k] != null)
            .map((k) => `${k} ${r[k]}`)
            .join(" · ")}`,
        });
        router.refresh();
      } else {
        setStatus({ kind: "error", text: `오류: ${j.error ?? res.status}` });
      }
    } catch {
      setStatus({ kind: "error", text: "오류: 서버에 연결할 수 없습니다." });
    }
  }

  const busy = status.kind === "busy";

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <SectionTitle>파일 가져오기</SectionTitle>
        <label
          className={
            "inline-flex cursor-pointer items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm text-paper " +
            (busy ? "pointer-events-none opacity-60" : "hover:opacity-90")
          }
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (fileRef.current) fileRef.current.value = "";
              if (!f) return;
              let json: unknown;
              try {
                json = JSON.parse(await f.text());
              } catch {
                setStatus({ kind: "error", text: "오류: JSON을 읽을 수 없습니다." });
                return;
              }
              await importJson(json, f.name);
            }}
          />
          {busy ? "가져오는 중…" : "JSON 파일 선택"}
        </label>

        <div className="mt-2 min-h-[20px] text-[12.5px]">
          {status.kind === "busy" && (
            <span className="text-ink-2">
              <span className="inline-block animate-pulse">●</span> {status.name}{" "}
              가져오는 중… 수십 초 걸릴 수 있습니다. 이 화면을 벗어나지 마세요.
            </span>
          )}
          {status.kind === "done" && (
            <span className="text-ink-2">✓ {status.text}</span>
          )}
          {status.kind === "error" && (
            <span className="text-over">{status.text}</span>
          )}
        </div>

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
    </div>
  );
}
