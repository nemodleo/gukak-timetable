import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "개인정보 안내 · 국악고 시간표" };

/** 로그인 없이 열리는 공개 쪽. 원본은 저장소 루트 PRIVACY.md 한 곳 — 여기서는 그리기만
 *  (첫 줄 제목은 PageHeader가 대신한다). servicekit privacy. */
export default function PrivacyPage() {
  const raw = fs.readFileSync(path.join(process.cwd(), "PRIVACY.md"), "utf-8");
  const body = raw.replace(/^# .*\n+/, "");
  const html = marked.parse(body, { gfm: true }) as string;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="국립국악고등학교" title="개인정보 안내" />
      <article
        className="docs-body max-w-[860px] break-keep [overflow-wrap:anywhere]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
