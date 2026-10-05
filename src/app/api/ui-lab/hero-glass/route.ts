import { isAgencyCompany } from "@/lib/client-utils";
import { sessionFromRequest } from "@/lib/server/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  HERO_GLASS_COMPONENT_KEY,
  INITIAL_HERO_GLASS_DRAFT,
  PUBLISHED_HERO_GLASS,
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
  const { data, error } = await getSupabaseAdmin()
    .from("ui_lab_drafts")
    .select("config,revision,updated_at")
    .eq("user_id", userId)
    .eq("component_key", HERO_GLASS_COMPONENT_KEY)
    .maybeSingle();
  if (error) return json({ error: "Não foi possível carregar o rascunho. A migração ui-lab-drafts.sql pode estar pendente." }, 503);
  return json({
    draft: parseHeroGlassConfig(data?.config) ?? INITIAL_HERO_GLASS_DRAFT,
    revision: data?.revision ?? 0,
    updatedAt: data?.updated_at ?? null,
    published: PUBLISHED_HERO_GLASS,
    githubReady: Boolean(process.env.UI_LAB_GITHUB_TOKEN?.trim()),
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

type GitHubFile = { sha: string; content: string; encoding: string };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origem inválida." }, 403);
  const userId = await agencyAdmin(request);
  if (!userId) return json({ error: "Acesso restrito aos administradores da agência." }, 403);
  const token = process.env.UI_LAB_GITHUB_TOKEN?.trim();
  if (!token) return json({ error: "Publicação no GitHub ainda não configurada. O rascunho está salvo no Nexa." }, 503);
  let raw: Record<string, unknown>;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Corpo inválido." }, 400);
  }
  const revision = raw.revision;
  if (!Number.isSafeInteger(revision) || Number(revision) < 1) return json({ error: "Versão inválida." }, 400);
  const { data, error } = await getSupabaseAdmin().from("ui_lab_drafts")
    .select("config,revision")
    .eq("user_id", userId)
    .eq("component_key", HERO_GLASS_COMPONENT_KEY)
    .maybeSingle();
  const config = parseHeroGlassConfig(data?.config);
  if (error || !config) return json({ error: "Salve o rascunho antes de publicar." }, 409);
  if (data?.revision !== revision) return json({ error: "O rascunho mudou. Aguarde o salvamento e tente novamente." }, 409);

  const repository = process.env.UI_LAB_GITHUB_REPOSITORY?.trim() || "nexamgmt-prog/otus-nexa-dashboard";
  const branch = process.env.UI_LAB_GITHUB_BRANCH?.trim() || "main";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[\w./-]+$/.test(branch)) {
    return json({ error: "Repositório de publicação inválido." }, 500);
  }
  const url = `https://api.github.com/repos/${repository}/contents/src/design-system/tokens.json`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  try {
    const current = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers, cache: "no-store" });
    if (!current.ok && current.status !== 404) return json({ error: `GitHub recusou a leitura do arquivo (${current.status}).` }, 502);
    const file = current.ok ? (await current.json()) as GitHubFile : null;
    const tokens = file && file.encoding === "base64"
      ? JSON.parse(Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8")) as Record<string, unknown>
      : {};
    tokens[HERO_GLASS_COMPONENT_KEY] = config;
    const response = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `design-system: publish ${HERO_GLASS_COMPONENT_KEY} (draft ${revision})`,
        branch,
        ...(file ? { sha: file.sha } : {}),
        content: Buffer.from(`${JSON.stringify(tokens, null, 2)}\n`).toString("base64"),
      }),
    });
    if (!response.ok) return json({ error: `GitHub recusou a publicação (${response.status}). Confira o acesso ao repositório e à branch.` }, 502);
    const result = await response.json() as { commit?: { sha?: string; html_url?: string } };
    return json({ ok: true, commit: result.commit?.sha ?? null, commitUrl: result.commit?.html_url ?? null, message: "Versão enviada ao GitHub. O deploy segue a integração do repositório com a Vercel." });
  } catch {
    return json({ error: "Falha ao publicar no GitHub. O rascunho continua salvo." }, 502);
  }
}
