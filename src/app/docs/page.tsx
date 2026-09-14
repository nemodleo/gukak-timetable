import Link from "next/link";
import { LockIcon, PageHeader } from "@/components/ui";
import { getRole } from "@/lib/auth";
import { MANUAL_SLUGS, MANUALS, visibleManuals, type ManualSlug } from "@/lib/manuals";

export const metadata = { title: "매뉴얼 · 국악고 시간표" };

export default async function DocsIndexPage() {
  const role = await getRole();
  const shown = new Set<ManualSlug>(visibleManuals(role));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="국립국악고등학교" title="매뉴얼" />
      <div className="grid gap-3 sm:grid-cols-3">
        {MANUAL_SLUGS.map((slug) => {
          const m = MANUALS[slug];
          const enabled = shown.has(slug);
          if (!enabled)
            return (
              <div
                key={slug}
                aria-disabled="true"
                title="권한이 없습니다"
                className="cursor-not-allowed rounded-lg border border-line bg-paper-2 p-4 opacity-50"
              >
                <h2 className="flex items-center gap-1.5 font-serif text-[17px] font-medium text-ink-3">
                  <LockIcon className="h-4 w-4 shrink-0" />
                  {m.title}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{m.desc}</p>
              </div>
            );
          return (
            <Link
              key={slug}
              href={`/docs/${slug}`}
              className="block rounded-lg border border-line p-4 transition-colors hover:border-clay hover:bg-paper-2"
            >
              <h2 className="font-serif text-[17px] font-medium text-ink">{m.title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{m.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
