import { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, makeToken, passwordRole } from "@/lib/auth";

export async function POST(req: Request) {
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (!process.env.ADMIN_PASSWORD && !process.env.INSTRUCTOR_PASSWORD) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD / INSTRUCTOR_PASSWORD 환경변수가 없습니다." },
      { status: 503 },
    );
  }
  const role = passwordRole(body.password);
  if (!role) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
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
