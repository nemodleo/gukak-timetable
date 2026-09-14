import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import clsx from "clsx";
import { notFound } from "next/navigation";
import { marked } from "marked";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getRole } from "@/lib/auth";
import { MANUALS, MANUAL_SLUGS, visibleManuals } from "@/lib/manuals";

export function generateStaticParams() {
  return MANUAL_SLUGS.map((slug) => ({ slug }));
}

// only these three slugs exist — anything else is a real 404, not a lookup
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = MANUALS[slug as keyof typeof MANUALS];
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
  const entry = MANUALS[slug as keyof typeof MANUALS];
  if (!entry) notFound();

  const role = await getRole();
  const shown = visibleManuals(role);

  const raw = fs.readFileSync(path.join(process.cwd(), "docs", entry.file), "utf-8");
  const html = renderMarkdown(raw);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="국립국악고등학교 · 매뉴얼"
        title={entry.title}
        actions={
          <div className="flex flex-wrap gap-1.5 text-[12px]" data-no-capture>
            {shown.map((key) => (
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
                {MANUALS[key].title}
              </Link>
            ))}
          </div>
        }
      />
      <article className="docs-body max-w-[860px]" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
