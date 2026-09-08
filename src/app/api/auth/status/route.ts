import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth";

export async function GET() {
  const role = await getRole();
  return NextResponse.json({
    role,
    admin: role === "admin",
    canEdit: role != null,
    configured: Boolean(
      process.env.ADMIN_PASSWORD || process.env.INSTRUCTOR_PASSWORD,
    ),
  });
}
