import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import clsx from "clsx";
import { notFound } from "next/navigation";
import { marked } from "marked";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { getRole } from "@/lib/auth";
import { MANUALS, MANUAL_SLUGS, visibleManuals, type ManualSlug } from "@/lib/manuals";

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

/** the role a viewer needs to actually read this manual (for the denial message) */
function requiredRoleLabel(slug: ManualSlug): string {
  if (slug === "admin") return "관리자";
  if (slug === "instructor") return "강사 또는 관리자";
  return "";
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
  const shown = new Set<ManualSlug>(visibleManuals(role));
  const allowed = shown.has(slug as ManualSlug);

  const html = allowed
    ? renderMarkdown(fs.readFileSync(path.join(process.cwd(), "docs", entry.file), "utf-8"))
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="국립국악고등학교 · 매뉴얼"
        title={entry.title}
        actions={
          <div className="flex flex-wrap gap-1.5 text-[12px]" data-no-capture>
            {MANUAL_SLUGS.map((key) => {
              const enabled = shown.has(key);
              if (!enabled)
                return (
                  <span
                    key={key}
                    aria-disabled="true"
                    title="권한이 없습니다"
                    className="cursor-not-allowed whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-ink-3 opacity-50"
                  >
                    {MANUALS[key].title}
                  </span>
                );
              return (
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
              );
            })}
          </div>
        }
      />
      {allowed ? (
        <article className="docs-body max-w-[860px]" dangerouslySetInnerHTML={{ __html: html! }} />
      ) : (
        <div className="max-w-[860px] rounded-lg border border-line bg-paper-2 px-6 py-10 text-center">
          <p className="text-[15px] font-medium text-ink">
            이 매뉴얼은 볼 수 있는 권한이 없습니다
          </p>
          <p className="mt-1.5 text-[13px] text-ink-2">
            {requiredRoleLabel(slug as ManualSlug)}만 열람할 수 있습니다. 오른쪽 위에서 로그인해
            주세요.
          </p>
        </div>
      )}
    </div>
  );
}
