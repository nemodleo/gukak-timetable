import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "gkt_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** admin / instructor may edit; viewer (학생·학부모 열람) is read-only.
 *  Every page that shows the timetable requires one of these — student
 *  names are on it, so nothing is served to anonymous visitors. */
export type Role = "admin" | "instructor" | "viewer";
const ROLES: readonly Role[] = ["admin", "instructor", "viewer"];

function secret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "dev-insecure-secret"
  );
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

/** token = "<role>.<ts>.<sig>" */
export function makeToken(role: Role): string {
  const ts = String(Date.now());
  const payload = `${role}.${ts}`;
  return `${payload}.${sign(payload)}`;
}

export function tokenRole(token: string | undefined | null): Role | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [role, ts, sig] = parts;
  if (!(ROLES as readonly string[]).includes(role)) return null;
  if (sign(`${role}.${ts}`) !== sig) return null;
  if (Date.now() - Number(ts) >= MAX_AGE * 1000) return null;
  return role as Role;
}

function eq(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** which role (if any) a submitted password grants */
export function passwordRole(input: string | undefined | null): Role | null {
  if (!input) return null;
  const admin = process.env.ADMIN_PASSWORD;
  const instructor = process.env.INSTRUCTOR_PASSWORD;
  const viewer = process.env.VIEWER_PASSWORD;
  if (admin && eq(input, admin)) return "admin";
  if (instructor && eq(input, instructor)) return "instructor";
  if (viewer && eq(input, viewer)) return "viewer";
  return null;
}

/** true for the roles that may change the timetable */
export function isEditorRole(role: Role | null | undefined): boolean {
  return role === "admin" || role === "instructor";
}

export async function getRole(): Promise<Role | null> {
  const jar = await cookies();
  return tokenRole(jar.get(COOKIE)?.value);
}

export async function isAdmin(): Promise<boolean> {
  return (await getRole()) === "admin";
}

/** admin OR instructor — anyone allowed to edit assignments */
export async function canEdit(): Promise<boolean> {
  return isEditorRole(await getRole());
}

/** any logged-in role, viewer included */
export async function isLoggedIn(): Promise<boolean> {
  return (await getRole()) != null;
}

/** at least one role password exists (otherwise nobody can log in) */
export function authConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_PASSWORD || process.env.INSTRUCTOR_PASSWORD || process.env.VIEWER_PASSWORD,
  );
}

export const AUTH_COOKIE = COOKIE;
export const AUTH_MAX_AGE = MAX_AGE;
