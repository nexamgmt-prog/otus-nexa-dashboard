import { NextResponse } from "next/server";
import {
  appUserFromDbRow,
  encodeAppPassword,
  findAppUserRowByIdentifier,
  sessionUserFromAppUser,
} from "@/lib/server/app-user-auth";
import { applySessionCookie, signSession } from "@/lib/server/session";

export async function POST(request: Request) {
  let body: { identifier?: string; password?: string };
  try {
    body = (await request.json()) as { identifier?: string; password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const identifier = String(body.identifier ?? "").trim();
  if (!identifier) {
    return NextResponse.json({ ok: false, error: "No account found with this email" }, { status: 401 });
  }

  const row = await findAppUserRowByIdentifier(identifier);
  if (!row) {
    return NextResponse.json({ ok: false, error: "No account found with this email" }, { status: 401 });
  }

  const storedHash = row.password_hash != null ? String(row.password_hash).trim() : "";
  if (!storedHash) {
    return NextResponse.json({ ok: true, needsPassword: true });
  }

  const password = String(body.password ?? "");
  if (!password.trim() || encodeAppPassword(password) !== storedHash) {
    return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
  }

  const user = appUserFromDbRow(row);
  const token = await signSession(sessionUserFromAppUser(user));
  const response = NextResponse.json({ ok: true, user });
  applySessionCookie(response, token);
  return response;
}
