import { NextResponse } from "next/server";
import { requireAdmin, requireDb } from "../_guard";
import bundled from "@/data/seed-2026.json";
import type { SeedPayload } from "@/lib/types";
import { ymOf } from "@/lib/schedule";

export const dynamic = "force-dynamic";

/** POST with no body -> load the bundled 2026 seed (per-month roster + blocks).
 *  POST with a JSON body of the same shape -> import that instead. */
export async function POST(req: Request) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;
  const { sb, res } = requireDb();
  if (res) return res;

  let payload: SeedPayload = bundled as unknown as SeedPayload;
  try {
    const body = await req.json();
    if (body && (body.pairings || body.settings || body.cells)) payload = body;
  } catch {
    /* no body -> bundled */
  }

  const report: Record<string, number> = {};

  // 1) settings
  if (payload.settings) {
    const s = payload.settings;
    const { error } = await sb.from("settings").upsert({
      id: 1,
      school_name: s.school_name,
      year: s.year,
      month: s.month,
      week_start: s.week_start,
      rooms: s.rooms,
      time_slots_weekday: s.time_slots_weekday,
      time_slots_weekend: s.time_slots_weekend,
      updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: `settings: ${error.message}` }, { status: 500 });
    report.settings = 1;
  }

  // 2) pairings (per-month roster, upsert by (ym,label))
  if (payload.pairings?.length) {
    const rows = payload.pairings.map((p, i) => ({
      ym: p.ym ?? "",
      student_name: p.student_name,
      grade: p.grade ?? "",
      teacher_name: p.teacher_name ?? "",
      target_hours: p.target_hours ?? null,
      label: p.label,
      sort_order: p.sort_order ?? i,
      active: p.active ?? true,
    }));
    const { error } = await sb.from("pairings").upsert(rows, { onConflict: "ym,label" });
    if (error) return NextResponse.json({ error: `pairings: ${error.message}` }, { status: 500 });
    report.pairings = rows.length;
  }

  // map "ym|label" -> id
  const { data: pairRows } = await sb.from("pairings").select("id,label,ym");
  const idByYmLabel = new Map(
    (pairRows ?? []).map((r) => [`${r.ym as string}|${r.label as string}`, r.id as string]),
  );

  // 3) schedule cells
  if (payload.cells?.length) {
    const rows = payload.cells
      .map((c) => {
        const base = { date: c.date, room: c.room, slot_index: c.slot_index };
        if (c.kind === "pairing") {
          const pid = c.label
            ? idByYmLabel.get(`${ymOf(c.date)}|${c.label}`)
            : undefined;
          if (!pid) return null;
          return { ...base, kind: "pairing" as const, pairing_id: pid, text: null, color: null };
        }
        // 비수업(block) — 메모(text)·색(color) 선택
        return {
          ...base,
          kind: "block" as const,
          pairing_id: null,
          text: c.text ?? null,
          color: c.color ?? null,
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;
    // chunk to stay well under payload limits
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb
        .from("schedule_cells")
        .upsert(rows.slice(i, i + 500), { onConflict: "date,room,slot_index" });
      if (error)
        return NextResponse.json({ error: `cells: ${error.message}` }, { status: 500 });
    }
    report.cells = rows.length;
    report.cells_skipped = payload.cells.length - rows.length;
  }

  // 4) memos
  if (payload.memos?.length) {
    const rows = payload.memos
      .map((m) => ({ date: m.date, lines: m.lines ?? {} }))
      .filter((m) => Object.keys(m.lines).length);
    if (rows.length) {
      const { error } = await sb.from("day_memos").upsert(rows, { onConflict: "date" });
      if (error) return NextResponse.json({ error: `memos: ${error.message}` }, { status: 500 });
    }
    report.memos = rows.length;
  }

  // 5) per-day time-band overrides
  if (payload.day_configs?.length) {
    const rows = payload.day_configs.map((dc) => ({
      date: dc.date,
      rooms: dc.rooms ?? null,
      slots: dc.slots ?? null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb
        .from("day_configs")
        .upsert(rows.slice(i, i + 500), { onConflict: "date" });
      if (error)
        return NextResponse.json({ error: `day_configs: ${error.message}` }, { status: 500 });
    }
    report.day_configs = rows.length;
  }

  return NextResponse.json({ ok: true, report });
}
