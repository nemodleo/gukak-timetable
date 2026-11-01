import { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, makeToken, passwordRole } from "@/lib/auth";
import {
  clientIp,
  dbStore,
  lockMessage,
  memoryStore,
  recordFailure,
  recordSuccess,
  retryAfterSec,
  type AttemptDb,
} from "@/lib/loginLimiter";
import { supabaseServer } from "@/lib/supabaseServer";

// one in-memory fallback per instance; the DB store is used when configured
const memory = memoryStore();
function attempts() {
  const sb = supabaseServer();
  // the cast only narrows supabase-js's deep generics to the 4 calls we use
  return sb ? dbStore(sb as unknown as AttemptDb, memory) : memory;
}

export async function POST(req: Request) {
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (
    !process.env.ADMIN_PASSWORD &&
    !process.env.INSTRUCTOR_PASSWORD &&
    !process.env.VIEWER_PASSWORD
  ) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD / INSTRUCTOR_PASSWORD / VIEWER_PASSWORD 환경변수가 없습니다." },
      { status: 503 },
    );
  }

  const store = attempts();
  const ip = clientIp(req.headers);
  const wait = await retryAfterSec(store, ip);
  if (wait > 0) {
    return NextResponse.json(
      { error: lockMessage(wait), retryAfter: wait },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  const role = passwordRole(body.password);
  if (!role) {
    const r = await recordFailure(store, ip);
    // a small fixed delay makes online guessing slower even inside the free window
    await new Promise((res) => setTimeout(res, 400));
    if (r.lockMs) {
      const sec = Math.ceil(r.lockMs / 1000);
      return NextResponse.json(
        { error: `비밀번호가 올바르지 않습니다. ${lockMessage(sec)}`, retryAfter: sec },
        { status: 429, headers: { "Retry-After": String(sec) } },
      );
    }
    const hint =
      r.remaining === 0
        ? " (한 번 더 틀리면 잠시 잠깁니다)"
        : r.remaining <= 2
          ? ` (${r.remaining}회 더 틀리면 잠시 잠깁니다)`
          : "";
    return NextResponse.json({ error: `비밀번호가 올바르지 않습니다.${hint}` }, { status: 401 });
  }

  await recordSuccess(store, ip);
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(AUTH_COOKIE, makeToken(role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
