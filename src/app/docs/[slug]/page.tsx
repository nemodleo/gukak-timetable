import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import clsx from "clsx";
import { notFound } from "next/navigation";
import { marked } from "marked";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";

/** the three manuals live as markdown in docs/ (also rendered directly by
 *  GitHub); this route serves the same content on the app's own domain. */
const MANUALS: Record<string, { file: string; title: string }> = {
  admin: { file: "admin-manual.md", title: "관리자 매뉴얼" },
  instructor: { file: "instructor-manual.md", title: "강사 매뉴얼" },
  student: { file: "student-manual.md", title: "학생 매뉴얼" },
};

export function generateStaticParams() {
  return Object.keys(MANUALS).map((slug) => ({ slug }));
}

// only these three slugs exist — anything else is a real 404, not a lookup
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = MANUALS[slug];
  return { title: entry ? `${entry.title} · 국악고 시간표` : "매뉴얼" };
}

/** docs/*.md is written for GitHub's renderer — relative image paths and
 *  sibling .md links — so rewrite both to this route's own URLs. */
function renderMarkdown(raw: string): string {
  const rewritten = raw
    .replace(/\]\(manual\//g, "](/docs/manual/")
    .replace(/src="manual\//g, 'src="/docs/manual/')
    .replace(/\(admin-manual\.md\)/g, "(/docs/admin)")
    .replace(/\(instructor-manual\.md\)/g, "(/docs/instructor)")
    .replace(/\(student-manual\.md\)/g, "(/docs/student)");
  return marked.parse(rewritten, { gfm: true }) as string;
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = MANUALS[slug];
  if (!entry) notFound();

  const raw = fs.readFileSync(path.join(process.cwd(), "docs", entry.file), "utf-8");
  const html = renderMarkdown(raw);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="국립국악고등학교 · 매뉴얼"
        title={entry.title}
        actions={
          <div className="flex flex-wrap gap-1.5 text-[12px]" data-no-capture>
            {Object.entries(MANUALS).map(([key, m]) => (
              <Link
                key={key}
                href={`/docs/${key}`}
                className={clsx(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 transition-colors",
                  key === slug
                    ? "border-clay bg-clay text-paper"
                    : "border-line-strong text-ink-2 hover:bg-paper-2",
                )}
              >
                {m.title}
              </Link>
            ))}
          </div>
        }
      />
      <article className="docs-body max-w-[860px]" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
