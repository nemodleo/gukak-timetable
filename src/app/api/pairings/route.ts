import { NextResponse } from "next/server";
import { requireAdmin, requireDb } from "../_guard";
import { getPairings, getSettings } from "@/lib/data";
import { ymKey } from "@/lib/schedule";

export const dynamic = "force-dynamic";

interface InPairing {
  id?: string;
  student_name: string;
  grade?: string;
  teacher_name?: string;
  target_hours?: number | null;
  label?: string;
  sort_order?: number;
  active?: boolean;
}

const YM_RE = /^\d{4}-\d{2}$/;

function normalize(p: InPairing, i: number, ym: string) {
  const student = (p.student_name ?? "").trim();
  const teacher = (p.teacher_name ?? "").trim();
  const label =
    (p.label ?? "").trim() || `${student}${teacher ? ` (${teacher}T)` : ""}`;
  return {
    ym,
    student_name: student,
    grade: (p.grade ?? "").trim(),
    teacher_name: teacher,
    target_hours:
      p.target_hours === undefined || p.target_hours === null || p.target_hours === ("" as unknown)
        ? null
        : Number(p.target_hours),
    label,
    sort_order: p.sort_order ?? i,
    active: p.active ?? true,
  };
}

async function resolveYm(req: Request): Promise<string> {
  const q = new URL(req.url).searchParams.get("ym");
  if (q && YM_RE.test(q)) return q;
  const s = await getSettings();
  return ymKey(s.year, s.month);
}

export async function GET(req: Request) {
  return NextResponse.json(await getPairings(await resolveYm(req)));
}

/** replace one month's roster wholesale:
 *  body = { ym: "YYYY-MM", pairings: [...] } (or a bare array + ?ym=) */
export async function PUT(req: Request) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;
  const { sb, res } = requireDb();
  if (res) return res;

  const body = await req.json();
  const bodyYm: string | undefined = Array.isArray(body) ? undefined : body?.ym;
  const ym = bodyYm && YM_RE.test(bodyYm) ? bodyYm : await resolveYm(req);

  const rows: InPairing[] = Array.isArray(body) ? body : body.pairings ?? [];
  const clean = rows
    .filter((r) => (r.student_name ?? "").trim())
    .map((r, i) => normalize(r, i, ym));

  if (clean.length) {
    const { error } = await sb
      .from("pairings")
      .upsert(clean, { onConflict: "ym,label" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // drop rows for this month that are no longer in the roster
  const keep = new Set(clean.map((r) => r.label));
  const { data: existing } = await sb
    .from("pairings")
    .select("id,label")
    .eq("ym", ym);
  const stale = (existing ?? [])
    .filter((r) => !keep.has(r.label as string))
    .map((r) => r.id as string);
  if (stale.length) {
    const { error: delErr } = await sb.from("pairings").delete().in("id", stale);
    if (delErr)
      return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json(await getPairings(ym));
}

export async function DELETE(req: Request) {
  const unauth = await requireAdmin();
  if (unauth) return unauth;
  const { sb, res } = requireDb();
  if (res) return res;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const { error } = await sb.from("pairings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
