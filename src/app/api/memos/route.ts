import { NextResponse } from "next/server";
import { requireDb, requireEditor } from "../_guard";
import { getMemos } from "@/lib/data";
import type { MemoLine, MemoSize } from "@/lib/types";

// 메모 편집 = 강사+관리자 로그인 필요.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  if (!from || !to)
    return NextResponse.json({ error: "from/to 필요" }, { status: 400 });
  return NextResponse.json(await getMemos(from, to));
}

/** replace a day's ruled memo. body: { date, lines: { "HH:MM": {text, red?} } } */
export async function PUT(req: Request) {
  const unauth = await requireEditor();
  if (unauth) return unauth;
  const { sb, res } = requireDb();
  if (res) return res;

  const body = await req.json();
  const date: string = body.date;
  if (!date) return NextResponse.json({ error: "date 필요" }, { status: 400 });

  const lines: Record<string, MemoLine> = {};
  const src = body.lines ?? {};
  for (const k of Object.keys(src)) {
    const t = String(src[k]?.text ?? "").trim();
    if (!t) continue;
    const sz = src[k]?.size as MemoSize | undefined;
    lines[k] = {
      text: t,
      ...(src[k]?.red ? { red: true } : {}),
      ...(sz && sz !== "m" ? { size: sz } : {}),
    };
  }

  if (Object.keys(lines).length === 0) {
    const { error } = await sb.from("day_memos").delete().eq("date", date);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb
      .from("day_memos")
      .upsert({ date, lines }, { onConflict: "date" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
