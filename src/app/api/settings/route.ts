import { NextResponse } from "next/server";
import { requireAdmin, requireDb } from "../_guard";
import { getSettings } from "@/lib/data";
import { DEFAULT_SETTINGS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PUT(req: Request) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;
  const { sb, res } = requireDb();
  if (res) return res;

  const body = await req.json();
  const merged = { ...DEFAULT_SETTINGS, ...body };
  const { error } = await sb
    .from("settings")
    .upsert({
      id: 1,
      school_name: merged.school_name,
      year: merged.year,
      month: merged.month,
      week_start: merged.week_start,
      rooms: merged.rooms,
      time_slots_weekday: merged.time_slots_weekday,
      time_slots_weekend: merged.time_slots_weekend,
      updated_at: new Date().toISOString(),
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(await getSettings());
}
