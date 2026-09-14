import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { requireAdmin, requireDaysApproved, requireDb, requireEditor } from "../_guard";
import { getCells } from "@/lib/data";

// 칸 PUT: 배정(pairing) = 강사+관리자. 비수업(block) 칸의 생성/수정/삭제 = 관리자만.
// 비활성 지정(active=false)도 관리자만 — 내용은 그대로 두고 강사 입력만 막는다.
// 날짜가 관리자 승인(day_approvals) 전이면 강사는 아예 쓸 수 없다(관리자는 무관).
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
  /** false = 비활성 지정. 내용(kind/pairing_id/text/color)은 그대로 두고
   *  강사 입력만 막는다 — 관리자만 바꿀 수 있다. */
  active?: boolean;
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
  if (c.active === false) return false; // 내용이 없어도 비활성 잠금은 남겨둬야 한다
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

  // 관리자가 승인(오픈)하지 않은 날짜 = 강사 입력 금지(관리자는 무관).
  const dayUnauth = await requireDaysApproved(list.map((c) => c.date));
  if (dayUnauth) return dayUnauth;

  // 비수업(block) 칸의 생성/수정, 비활성 지정/해제 자체 = 관리자만.
  // 이미 비활성 지정된 칸(내용 있는 배정 포함)의 수정도 관리자만.
  const admin = await isAdmin();
  if (!admin) {
    if (list.some((c) => c.kind === "block" || c.active === false)) {
      return NextResponse.json({ error: "비활성 칸은 관리자만 수정할 수 있습니다." }, { status: 403 });
    }
    const { data: existing } = await sb
      .from("schedule_cells")
      .select("date,room,slot_index,kind,active")
      .in("date", [...new Set(list.map((c) => c.date))]);
    const lockedKeys = new Set(
      (existing ?? [])
        .filter((r) => r.kind === "block" || r.active === false)
        .map((r) => `${r.date}|${r.room}|${r.slot_index}`),
    );
    if (list.some((c) => lockedKeys.has(`${c.date}|${c.room}|${c.slot_index}`))) {
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
      active: c.active ?? true,
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
