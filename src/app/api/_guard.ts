import { NextResponse } from "next/server";
import { canEdit, isAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  return null;
}

/** admin OR instructor — anyone logged in to edit assignments */
export async function requireEditor(): Promise<NextResponse | null> {
  if (!(await canEdit())) {
    return NextResponse.json(
      { error: "로그인이 필요합니다. (강사 또는 관리자)" },
      { status: 401 },
    );
  }
  return null;
}

/** admin bypasses; instructor is blocked if ANY of these dates isn't
 *  approved (missing row = locked, the default). */
export async function requireDaysApproved(dates: string[]): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  const uniq = [...new Set(dates)];
  if (!uniq.length) return null;
  const sb = supabaseServer();
  if (!sb) return null; // demo mode — no DB, locks don't apply
  const { data } = await sb
    .from("day_approvals")
    .select("date,approved")
    .in("date", uniq);
  const approved = new Set((data ?? []).filter((r) => r.approved).map((r) => r.date as string));
  if (uniq.some((d) => !approved.has(d))) {
    return NextResponse.json(
      { error: "관리자가 아직 승인하지 않은 날짜입니다." },
      { status: 403 },
    );
  }
  return null;
}

export function requireDb():
  | { sb: SupabaseClient; res?: undefined }
  | { sb?: undefined; res: NextResponse } {
  const sb = supabaseServer();
  if (!sb) {
    return {
      res: NextResponse.json(
        { error: "Supabase가 설정되지 않았습니다. 환경변수를 확인하세요." },
        { status: 503 },
      ),
    };
  }
  return { sb };
}
