import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { requireAdmin, requireDb, requireEditor } from "../_guard";
import { getCells } from "@/lib/data";

// 칸 PUT: 배정(pairing) = 강사+관리자. 비수업(block) 칸의 생성/수정/삭제 = 관리자만.
// 날짜 전체 삭제(구조 재저장용) = 관리자만.

export const dynamic = "force-dynamic";

const COLORS = new Set(["y", "r", "g", "b"]);

interface InCell {
  date: string;
  room: string;
  slot_index: number;
  kind?: "pairing" | "block" | null;
  pairing_id?: string | null;
  text?: string | null;
  color?: string | null;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  if (!from || !to)
    return NextResponse.json({ error: "from/to 필요" }, { status: 400 });
  return NextResponse.json(await getCells(from, to));
}

function isEmpty(c: InCell): boolean {
  if (!c.kind) return true;
  if (c.kind === "block") return false;
  return !c.pairing_id; // pairing
}

export async function PUT(req: Request) {
  const unauth = await requireEditor();
  if (unauth) return unauth;
  const { sb, res } = requireDb();
  if (res) return res;

  const body = await req.json();
  const list: InCell[] = Array.isArray(body) ? body : [body];

  // 비수업(block) 칸은 관리자만 만들거나 건드릴 수 있다
  const admin = await isAdmin();
  if (!admin) {
    if (list.some((c) => c.kind === "block")) {
      return NextResponse.json({ error: "비활성 칸은 관리자만 수정할 수 있습니다." }, { status: 403 });
    }
    const { data: existing } = await sb
      .from("schedule_cells")
      .select("date,room,slot_index,kind")
      .in("date", [...new Set(list.map((c) => c.date))]);
    const blockKeys = new Set(
      (existing ?? [])
        .filter((r) => r.kind === "block")
        .map((r) => `${r.date}|${r.room}|${r.slot_index}`),
    );
    if (list.some((c) => blockKeys.has(`${c.date}|${c.room}|${c.slot_index}`))) {
      return NextResponse.json({ error: "비활성 칸은 관리자만 수정할 수 있습니다." }, { status: 403 });
    }
  }

  const toDelete = list.filter(isEmpty);
  const toUpsert = list.filter((c) => !isEmpty(c));

  for (const c of toDelete) {
    const { error } = await sb
      .from("schedule_cells")
      .delete()
      .match({ date: c.date, room: c.room, slot_index: c.slot_index });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (toUpsert.length) {
    const rows = toUpsert.map((c) => ({
      date: c.date,
      room: c.room,
      slot_index: c.slot_index,
      kind: c.kind,
      pairing_id: c.kind === "pairing" ? c.pairing_id : null,
      text: c.kind === "block" ? c.text ?? null : null,
      color:
        c.kind === "block" && c.color && COLORS.has(c.color) ? c.color : null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await sb
      .from("schedule_cells")
      .upsert(rows, { onConflict: "date,room,slot_index" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, upserted: toUpsert.length, deleted: toDelete.length });
}

/** DELETE ?date=YYYY-MM-DD  → clear every cell on that date (used before a
 *  structural re-save so slot_index renumbering can't leave stale rows). */
export async function DELETE(req: Request) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;
  const { sb, res } = requireDb();
  if (res) return res;
  const date = new URL(req.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date 필요" }, { status: 400 });
  const { error } = await sb.from("schedule_cells").delete().eq("date", date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
