import { NextResponse } from "next/server";
import {
  appUserFromDbRow,
  encodeAppPassword,
  findAppUserRowByIdentifier,
  sessionUserFromAppUser,
} from "@/lib/server/app-user-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { applySessionCookie, signSession } from "@/lib/server/session";

export async function POST(request: Request) {
  let body: { identifier?: string; password?: string };
  try {
    body = (await request.json()) as { identifier?: string; password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const identifier = String(body.identifier ?? "").trim();
  const password = String(body.password ?? "");
  if (!identifier || !password.trim()) {
    return NextResponse.json({ ok: false, error: "Password is required." }, { status: 400 });
  }

  const row = await findAppUserRowByIdentifier(identifier);
  if (!row) {
    return NextResponse.json({ ok: false, error: "No account found with this email" }, { status: 401 });
  }

  const storedHash = row.password_hash != null ? String(row.password_hash).trim() : "";
  if (storedHash) {
    return NextResponse.json({ ok: false, error: "Password already set." }, { status: 409 });
  }

  const hash = encodeAppPassword(password);
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("app_users")
    .update({ password_hash: hash })
    .eq("id", String(row.id))
    .select("*")
    .single();

  if (error || !data) {
    console.error("[auth] first-access update failed:", error?.message);
    return NextResponse.json({ ok: false, error: "Could not save password." }, { status: 500 });
  }

  const user = appUserFromDbRow(data as Record<string, unknown>);
  const token = await signSession(sessionUserFromAppUser(user));
  const response = NextResponse.json({ ok: true, user });
  applySessionCookie(response, token);
  return response;
}
