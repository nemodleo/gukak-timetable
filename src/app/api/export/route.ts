import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { getAllPairings, getCells, getMemos, getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

/** full backup dump (admin only). Same shape as the seed payload. */
export async function GET() {
  const unauth = await requireAdmin();
  if (unauth) return unauth;

  const settings = await getSettings();
  const [pairings, cells, memos] = await Promise.all([
    getAllPairings(),
    getCells("1900-01-01", "2999-12-31"),
    getMemos("1900-01-01", "2999-12-31"),
  ]);

  const byId = new Map(pairings.map((p) => [p.id, p.label]));
  const payload = {
    settings,
    pairings: pairings.map(({ id, ...rest }) => {
      void id;
      return rest;
    }),
    cells: cells.map((c) => ({
      date: c.date,
      room: c.room,
      slot_index: c.slot_index,
      kind: c.kind,
      label: c.kind === "pairing" ? byId.get(c.pairing_id ?? "") ?? null : null,
      text: c.text,
      color: c.color ?? null,
    })),
    memos,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="gukak-timetable-backup.json"`,
    },
  });
}
