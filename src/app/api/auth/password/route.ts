import { NextResponse } from "next/server";
import { encodeAppPassword } from "@/lib/server/app-user-auth";
import { requireApiUser, sessionIsAgencyAdmin } from "@/lib/server/require-api-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  let body: { userId?: string; password?: string };
  try {
    body = (await request.json()) as { userId?: string; password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  const password = String(body.password ?? "").trim();
  if (!userId || !password) {
    return NextResponse.json({ ok: false, error: "userId and password are required." }, { status: 400 });
  }

  if (auth.user.id !== userId && !sessionIsAgencyAdmin(auth.user)) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("app_users").update({ password_hash: encodeAppPassword(password) }).eq("id", userId);
  if (error) {
    console.error("[auth] password update failed:", error.message);
    return NextResponse.json({ ok: false, error: "Could not save password." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
