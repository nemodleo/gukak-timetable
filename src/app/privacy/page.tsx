import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "개인정보 안내 · 국악고 시간표" };

/** 로그인 없이 열리는 공개 쪽. 원본은 저장소 루트 PRIVACY.md 한 곳 — 여기서는 그리기만
 *  (첫 줄 제목은 PageHeader가 대신한다). servicekit privacy. */
export default function PrivacyPage() {
  const raw = fs.readFileSync(path.join(process.cwd(), "PRIVACY.md"), "utf-8");
  const body = raw.replace(/^# .*\n+/, "");
  const html = marked.parse(body, { gfm: true }) as string;
  return (
    <div className="space-y-6">
      {/* 보드 00-current-privacy대로: 머리 라벨 12px·ink-2(공용 label-eyebrow는 11px·ink-3라 대비가 모자람) */}
      <div className="border-b border-line pb-4">
        <p className="text-[12px] font-semibold tracking-wide text-ink-2">국립국악고등학교</p>
        <h1 className="mt-1 font-serif text-[24px] font-medium tracking-tight text-ink sm:text-[27px]">
          개인정보 안내
        </h1>
      </div>
      <article
        className="docs-body privacy-body max-w-[860px] break-keep [overflow-wrap:anywhere]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
