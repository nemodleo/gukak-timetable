/** client-side JSON calls to our own API routes. Resolves to null on success
 *  or to the error message (server's `error`, else the HTTP status, else the
 *  network error) — so callers read `const err = await putJson(...)`. */
export async function sendJson(
  url: string,
  method: "PUT" | "POST" | "DELETE",
  body?: unknown,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (res.ok) return null;
    const j = await res.json().catch(() => ({}));
    return String(j.error ?? res.status);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

export const putJson = (url: string, body: unknown) => sendJson(url, "PUT", body);

/** 날짜 승인/잠금 일괄 저장 — 월간 드래그·월 전체·일간 헤더 버튼이 같이 쓴다 */
export const saveDayApprovals = (dates: string[], approved: boolean) =>
  putJson("/api/day-approvals", { dates, approved });

/** `prev` with `dates` added (approved) or removed (locked) — a new Set */
export function withApproval(prev: Set<string>, dates: string[], approved: boolean): Set<string> {
  const next = new Set(prev);
  for (const d of dates) {
    if (approved) next.add(d);
    else next.delete(d);
  }
  return next;
}
