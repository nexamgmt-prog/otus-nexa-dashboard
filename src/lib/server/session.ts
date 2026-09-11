import { NextResponse } from "next/server";
import type { Role, UserCompany } from "@/types";

export const SESSION_COOKIE = "nexa_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14;

export type SessionUser = {
  id: string;
  role: Role;
  company: UserCompany;
  clientSlug: string | null;
};

type SessionPayload = SessionUser & { exp: number };

function sessionSecret(): string {
  const secret =
    process.env.NEXA_SESSION_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!secret) {
    throw new Error("NEXA_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY is required to sign sessions.");
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(user: SessionUser): Promise<string> {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSha256(body);
  return `${body}.${sig}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let expected: string;
  try {
    expected = await hmacSha256(body);
  } catch {
    return null;
  }
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (!json?.id || typeof json.exp !== "number" || json.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    const role: Role = json.role === "admin" || json.role === "manager" ? json.role : "manager";
    return {
      id: String(json.id),
      role,
      company: String(json.company ?? "") as UserCompany,
      clientSlug: json.clientSlug ? String(json.clientSlug) : null,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

export function applySessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}

export function sessionFromRequest(request: Request): Promise<SessionUser | null> {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(/;\s*/).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null;
  return verifySession(token);
}
