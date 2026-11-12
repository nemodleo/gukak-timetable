import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { getRole } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { hasSupabase } from "@/lib/supabaseServer";
import {
  DEFAULT_GRADE_COLORS,
  DEFAULT_INACTIVE_BG_COLOR,
  DEFAULT_INACTIVE_PATTERN,
  DEFAULT_INACTIVE_PATTERN_COLOR,
} from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { ConfigNotice } from "@/components/ConfigNotice";
import { InactiveStyleProvider } from "@/lib/inactiveStyleContext";
import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "국악고 시간표",
  description: "국립국악고등학교 강사·강의실 시간표 및 통계",
  // 학생 이름이 있는 내부 도구 — 검색 결과에 나오지 않게(robots.ts와 짝)
  robots: { index: false, follow: false },
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
  const inactiveStyle = {
    bgColor: settings?.inactive_bg_color ?? DEFAULT_INACTIVE_BG_COLOR,
    patternColor: settings?.inactive_pattern_color ?? DEFAULT_INACTIVE_PATTERN_COLOR,
    pattern: settings?.inactive_pattern ?? DEFAULT_INACTIVE_PATTERN,
  };
  return (
    <html lang="ko" style={paletteVars}>
      <body className="min-h-screen overflow-x-hidden">
        <InactiveStyleProvider value={inactiveStyle}>
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
          {/* 사이트 꼬리 — 로그인한 선생님도 연락처를 찾을 수 있게. 인쇄·이미지 저장에서는 빠짐 */}
          <footer
            className="no-print mx-auto flex max-w-[1400px] flex-wrap gap-x-3 gap-y-1 break-keep border-t border-line px-4 py-4 text-[13px] text-ink-2 [overflow-wrap:anywhere] sm:px-8"
            data-no-capture
          >
            <span>국립국악고등학교 강사·강의실 시간표</span>
            <Link href="/privacy" className="underline decoration-clay underline-offset-4">
              개인정보 안내
            </Link>
            <span>
              문의{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="underline decoration-clay underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
            </span>
          </footer>
        </InactiveStyleProvider>
        <Analytics />
      </body>
    </html>
  );
}
