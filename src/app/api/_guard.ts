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
