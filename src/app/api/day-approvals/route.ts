import { NextResponse } from "next/server";
import { requireAdmin, requireDb } from "../_guard";
import { getDayApprovals } from "@/lib/data";

// 날짜 승인(잠금 해제) = 관리자만. 기본은 잠금 — 승인된 날짜만 강사가
// 배정·메모를 편집할 수 있다.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  if (!from || !to)
    return NextResponse.json({ error: "from/to 필요" }, { status: 400 });
  return NextResponse.json([...(await getDayApprovals(from, to))]);
}

/** body: { dates: string[], approved: boolean } — bulk set (drag-paint on the month view). */
export async function PUT(req: Request) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;
  const { sb, res } = requireDb();
  if (res) return res;

  const body = await req.json();
  const dates: string[] = Array.isArray(body.dates) ? body.dates.filter(Boolean) : [];
  const approved = !!body.approved;
  if (!dates.length) return NextResponse.json({ error: "dates 필요" }, { status: 400 });

  const rows = dates.map((date) => ({
    date,
    approved,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await sb.from("day_approvals").upsert(rows, { onConflict: "date" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: dates.length });
}
