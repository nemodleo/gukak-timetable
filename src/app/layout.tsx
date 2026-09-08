import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getRole } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "시간표 · 강사·강의실 배정",
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
          year={settings?.year ?? 2026}
          month={settings?.month ?? 7}
          role={role}
        />
        <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
