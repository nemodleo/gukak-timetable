import { NextResponse } from "next/server";
import { requireAdmin, requireDb } from "../_guard";
import { getDayConfigs } from "@/lib/data";
import type { SlotDef } from "@/lib/types";

// 그리드 구조(강의실·시간블록) 변경은 관리자만 가능.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  if (!from || !to)
    return NextResponse.json({ error: "from/to 필요" }, { status: 400 });
  return NextResponse.json(await getDayConfigs(from, to));
}

/** upsert a per-day grid override + drop orphaned cells (removed room / trimmed slot). */
export async function PUT(req: Request) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;
  const { sb, res } = requireDb();
  if (res) return res;

  const body = (await req.json()) as {
    date: string;
    rooms: string[] | null;
    slots: SlotDef[] | null;
  };
  if (!body.date) return NextResponse.json({ error: "date 필요" }, { status: 400 });

  const rooms =
    Array.isArray(body.rooms) && body.rooms.length
      ? body.rooms.map((r) => String(r).trim()).filter(Boolean)
      : null;
  const slots =
    Array.isArray(body.slots) && body.slots.length
      ? body.slots.map((s) => ({
          start: String(s.start ?? "00:00"),
          end: String(s.end ?? "00:00"),
          ...(s.label ? { label: String(s.label) } : {}),
        }))
      : null;

  if (rooms === null && slots === null) {
    const { error } = await sb.from("day_configs").delete().eq("date", body.date);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb
      .from("day_configs")
      .upsert({ date: body.date, rooms, slots }, { onConflict: "date" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // orphan cleanup
  const { data: dayCells } = await sb
    .from("schedule_cells")
    .select("id,room,slot_index")
    .eq("date", body.date);
  const roomSet = rooms ? new Set(rooms) : null;
  const maxSlot = slots ? slots.length : null;
  const orphanIds = (dayCells ?? [])
    .filter(
      (c) =>
        (roomSet && !roomSet.has(c.room)) ||
        (maxSlot != null && c.slot_index >= maxSlot),
    )
    .map((c) => c.id);
  if (orphanIds.length) {
    await sb.from("schedule_cells").delete().in("id", orphanIds);
  }

  return NextResponse.json({ ok: true, removedCells: orphanIds.length });
}

export async function DELETE(req: Request) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;
  const { sb, res } = requireDb();
  if (res) return res;
  const date = new URL(req.url).searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date 필요" }, { status: 400 });
  const { error } = await sb.from("day_configs").delete().eq("date", date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
