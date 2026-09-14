import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getRole } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { hasSupabase } from "@/lib/supabaseServer";
import { DEFAULT_GRADE_COLORS } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { ConfigNotice } from "@/components/ConfigNotice";

export const metadata: Metadata = {
  title: "국악고 시간표",
  description: "국립국악고등학교 강사·강의실 시간표 및 통계",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [settings, role] = await Promise.all([
    getSettings().catch(() => null),
    getRole().catch(() => null),
  ]);
  // admin-configurable palette (Settings → 색 팔레트) — override the "badge"
  // tone custom properties; the soft cell wash derives from these via
  // color-mix() in globals.css, so this one override covers both.
  const gc = settings?.grade_colors ?? DEFAULT_GRADE_COLORS;
  const paletteVars = {
    "--color-g1-badge": gc.g1,
    "--color-g2-badge": gc.g2,
    "--color-g3-badge": gc.g3,
    "--color-gm-badge": gc.gm,
  } as React.CSSProperties;
  return (
    <html lang="ko" style={paletteVars}>
      <body className="min-h-screen overflow-x-hidden">
        <SiteHeader
          schoolName={settings?.school_name ?? "국립국악고등학교"}
          role={role}
        />
        <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8">
          {!hasSupabase() && (
            <div className="mb-6">
              <ConfigNotice />
            </div>
          )}
          {children}
        </main>
      </body>
    </html>
  );
}
