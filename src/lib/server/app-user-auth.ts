import { parseHeroClocks } from "@/lib/hero-clocks";
import { ALL_MODULE_KEYS } from "@/lib/modules";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { AppUser, ModuleKey, Role, UserCompany } from "@/types";
import type { SessionUser } from "@/lib/server/session";

export function encodeAppPassword(password: string): string {
  return btoa(unescape(encodeURIComponent(password)));
}

function normalizeUserCompany(value: unknown): UserCompany {
  return String(value ?? "").toLowerCase().trim();
}

function normalizeUserRole(value: unknown): Role {
  return value === "admin" || value === "manager" ? value : "manager";
}

function normalizeUserModules(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((m): m is ModuleKey => ALL_MODULE_KEYS.includes(m as ModuleKey));
}

export function appUserFromDbRow(row: Record<string, unknown>): AppUser {
  const clientSlugRaw = row.client_slug;
  const clientSlug =
    clientSlugRaw != null && String(clientSlugRaw).trim() !== "" ? String(clientSlugRaw).trim() : null;
  const localePrefRaw = row.locale_preference;
  const localePreference = localePrefRaw === "pt-BR" || localePrefRaw === "en" ? localePrefRaw : null;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: row.email != null && String(row.email) !== "" ? String(row.email) : null,
    role: normalizeUserRole(row.role),
    company: normalizeUserCompany(row.company),
    modules: normalizeUserModules(row.modules),
    clientSlug,
    localePreference,
    avatarUrl:
      row.avatar_url != null && String(row.avatar_url).trim() !== "" ? String(row.avatar_url).trim() : null,
    heroClocks: parseHeroClocks(row.hero_clocks),
  };
}

export function sessionUserFromAppUser(user: AppUser): SessionUser {
  return {
    id: user.id,
    role: user.role,
    company: user.company,
    clientSlug: user.clientSlug,
  };
}

export async function findAppUserRowByIdentifier(identifier: string): Promise<Record<string, unknown> | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  const admin = getSupabaseAdmin();
  const { data: byEmail, error: emailErr } = await admin.from("app_users").select("*").ilike("email", trimmed);
  if (emailErr) {
    console.error("[auth] app_users email lookup failed:", emailErr.message);
    return null;
  }
  const emailRow = ((byEmail as Array<Record<string, unknown>> | null) ?? [])[0];
  if (emailRow) return emailRow;
  const { data: byName, error: nameErr } = await admin.from("app_users").select("*").ilike("name", trimmed);
  if (nameErr) {
    console.error("[auth] app_users name lookup failed:", nameErr.message);
    return null;
  }
  return ((byName as Array<Record<string, unknown>> | null) ?? [])[0] ?? null;
}
