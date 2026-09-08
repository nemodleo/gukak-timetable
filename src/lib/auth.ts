import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "gkt_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type Role = "admin" | "instructor";

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
  if (role !== "admin" && role !== "instructor") return null;
  if (sign(`${role}.${ts}`) !== sig) return null;
  if (Date.now() - Number(ts) >= MAX_AGE * 1000) return null;
  return role;
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
  if (admin && eq(input, admin)) return "admin";
  if (instructor && eq(input, instructor)) return "instructor";
  return null;
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
  return (await getRole()) != null;
}

export const AUTH_COOKIE = COOKIE;
export const AUTH_MAX_AGE = MAX_AGE;
