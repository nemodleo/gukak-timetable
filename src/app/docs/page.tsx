import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getRole } from "@/lib/auth";
import { MANUALS, visibleManuals } from "@/lib/manuals";

export const metadata = { title: "매뉴얼 · 국악고 시간표" };

export default async function DocsIndexPage() {
  const role = await getRole();
  const shown = visibleManuals(role);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="국립국악고등학교" title="매뉴얼" />
      <div className="grid gap-3 sm:grid-cols-3">
        {shown.map((slug) => {
          const m = MANUALS[slug];
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
