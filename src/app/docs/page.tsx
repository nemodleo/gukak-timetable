import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "매뉴얼 · 국악고 시간표" };

const MANUALS = [
  {
    slug: "admin",
    title: "관리자 매뉴얼",
    desc: "시간표 담당 교사용 — 전 기능(로그인·권한, 칸 편집, 비활성 지정, 그리드 구조, 명단·목표시수·설정·데이터, 통계, 문제 해결).",
  },
  {
    slug: "instructor",
    title: "강사 매뉴얼",
    desc: "강사용 — 로그인, 보기/편집, 학생 배정·이동, 메모, 되돌리기, 이미지 저장, 통계 열람.",
  },
  {
    slug: "student",
    title: "학생 매뉴얼",
    desc: "로그인 없이 보는 학생용 — 월→주→일 보기, 색·빗금 의미, 내 시간표 이미지 저장.",
  },
] as const;

export default function DocsIndexPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="국립국악고등학교" title="매뉴얼" />
      <div className="grid gap-3 sm:grid-cols-3">
        {MANUALS.map((m) => (
          <Link
            key={m.slug}
            href={`/docs/${m.slug}`}
            className="block rounded-lg border border-line p-4 transition-colors hover:border-clay hover:bg-paper-2"
          >
            <h2 className="font-serif text-[17px] font-medium text-ink">{m.title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
