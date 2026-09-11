import { NextResponse } from "next/server";
import { isAgencyCompany } from "@/lib/client-utils";
import { clientSlugFromRequest } from "@/lib/server/load-client-api-credentials";
import { sessionFromRequest, type SessionUser } from "@/lib/server/session";

export function sessionCanAccessClient(user: SessionUser, requestedSlug: string | null): boolean {
  if (isAgencyCompany(user.company)) return true;
  if (!requestedSlug) return false;
  const own = user.clientSlug?.trim() || (user.company && !isAgencyCompany(user.company) ? String(user.company) : "");
  return Boolean(own) && own === requestedSlug;
}

export function sessionIsAgencyAdmin(user: SessionUser): boolean {
  return isAgencyCompany(user.company) && user.role === "admin";
}

export function sessionCanManageClientSecrets(user: SessionUser, clientSlug: string): boolean {
  if (sessionIsAgencyAdmin(user)) return true;
  if (user.role !== "admin") return false;
  const own = user.clientSlug?.trim() || (!isAgencyCompany(user.company) ? String(user.company) : "");
  return Boolean(own) && own === clientSlug;
}

export async function requireApiUser(
  request: Request,
): Promise<{ ok: true; user: SessionUser } | { ok: false; response: NextResponse }> {
  const user = await sessionFromRequest(request);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }
  return { ok: true, user };
}

export async function requireDashboardApi(
  request: Request,
): Promise<
  { ok: true; user: SessionUser; clientSlug: string | null } | { ok: false; response: NextResponse }
> {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth;
  const clientSlug = clientSlugFromRequest(request);
  if (!sessionCanAccessClient(auth.user, clientSlug)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }
  return { ok: true, user: auth.user, clientSlug };
}
