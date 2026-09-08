import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getRole } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { hasSupabase } from "@/lib/supabaseServer";
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
  return (
    <html lang="ko">
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
