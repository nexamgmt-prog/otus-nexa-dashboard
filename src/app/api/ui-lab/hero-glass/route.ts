import { isAgencyCompany } from "@/lib/client-utils";
import { sessionFromRequest } from "@/lib/server/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  HERO_GLASS_COMPONENT_KEY,
  INITIAL_HERO_GLASS_DRAFT,
  PUBLISHED_HERO_GLASS,
  PUBLISHED_UI_LAB_USER_ID,
  parseHeroGlassConfig,
} from "@/lib/ui-lab/hero-glass";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

async function agencyAdmin(request: Request) {
  const session = await sessionFromRequest(request);
  if (!session || session.role !== "admin" || !isAgencyCompany(session.company)) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("app_users")
    .select("id,role,company")
    .eq("id", session.id)
    .maybeSingle();
  if (error || !data || data.role !== "admin" || !isAgencyCompany(data.company)) return null;
  return session.id;
}

export async function GET(request: Request) {
  const userId = await agencyAdmin(request);
  if (!userId) return json({ error: "Acesso restrito aos administradores da agência." }, 403);
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("ui_lab_drafts")
    .select("config,revision,updated_at")
    .eq("user_id", userId)
    .eq("component_key", HERO_GLASS_COMPONENT_KEY)
    .maybeSingle();
  if (error) return json({ error: "Não foi possível carregar o rascunho. A migração ui-lab-drafts.sql pode estar pendente." }, 503);
  const { data: publishedRow, error: publishedError } = await db
    .from("ui_lab_drafts")
    .select("config,revision,updated_at")
    .eq("user_id", PUBLISHED_UI_LAB_USER_ID)
    .eq("component_key", HERO_GLASS_COMPONENT_KEY)
    .maybeSingle();
  if (publishedError) return json({ error: "Não foi possível carregar a versão publicada." }, 503);
  return json({
    draft: parseHeroGlassConfig(data?.config) ?? INITIAL_HERO_GLASS_DRAFT,
    revision: data?.revision ?? 0,
    updatedAt: data?.updated_at ?? null,
    published: parseHeroGlassConfig(publishedRow?.config) ?? PUBLISHED_HERO_GLASS,
    publishedAt: publishedRow?.updated_at ?? null,
    canPublish: true,
  });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const userId = await agencyAdmin(request);
  if (!userId) return json({ error: "Acesso restrito aos administradores da agência." }, 403);
  let raw: Record<string, unknown>;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }
  const config = parseHeroGlassConfig(raw.config);
  const revision = raw.revision;
  if (!config || !Number.isSafeInteger(revision) || Number(revision) < 0) {
    return json({ error: "Configuração ou versão inválida." }, 400);
  }
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  if (revision === 0) {
    const { error } = await db.from("ui_lab_drafts").insert({
      user_id: userId,
      component_key: HERO_GLASS_COMPONENT_KEY,
      config,
      revision: 1,
      updated_at: now,
    });
    if (error) return json({ error: error.code === "23505" ? "Rascunho alterado em outra aba. Recarregue a página." : "Não foi possível salvar o rascunho." }, error.code === "23505" ? 409 : 503);
    return json({ revision: 1, updatedAt: now });
  }
  const { data, error } = await db.from("ui_lab_drafts")
    .update({ config, revision: Number(revision) + 1, updated_at: now })
    .eq("user_id", userId)
    .eq("component_key", HERO_GLASS_COMPONENT_KEY)
    .eq("revision", revision)
    .select("revision")
    .maybeSingle();
  if (error) return json({ error: "Não foi possível salvar o rascunho." }, 503);
  if (!data) return json({ error: "Rascunho alterado em outra aba. Recarregue a página." }, 409);
  return json({ revision: data.revision, updatedAt: now });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const userId = await agencyAdmin(request);
  if (!userId) return json({ error: "Acesso restrito aos administradores da agência." }, 403);
  let raw: Record<string, unknown>;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }
  const revision = raw.revision;
  if (!Number.isSafeInteger(revision) || Number(revision) < 1) return json({ error: "Versão inválida." }, 400);
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("ui_lab_drafts")
    .select("config,revision")
    .eq("user_id", userId)
    .eq("component_key", HERO_GLASS_COMPONENT_KEY)
    .maybeSingle();
  const config = parseHeroGlassConfig(data?.config);
  if (error || !config) return json({ error: "Salve o rascunho antes de publicar." }, 409);
  if (data?.revision !== revision) return json({ error: "O rascunho mudou. Aguarde o salvamento e tente novamente." }, 409);

  const now = new Date().toISOString();
  const { data: published, error: publishError } = await db.from("ui_lab_drafts")
    .upsert({
      user_id: PUBLISHED_UI_LAB_USER_ID,
      component_key: HERO_GLASS_COMPONENT_KEY,
      config,
      revision: Date.now(),
      updated_at: now,
    }, { onConflict: "user_id,component_key" })
    .select("updated_at")
    .single();
  if (publishError || !published) return json({ error: "Não foi possível aplicar o efeito. O rascunho continua salvo." }, 503);
  return json({ ok: true, publishedAt: published.updated_at, message: "Efeito publicado. O dashboard usa esta versão ao recarregar." });
}
