import { NextResponse } from "next/server";
import { clientApiCredentialsToDb, parseClientApiCredentials } from "@/lib/client-api-credentials";
import { clientCrmIntegrationToDb, parseClientCrmIntegration } from "@/lib/client-crm-integration";
import { invalidateClientApiCredentialsCache } from "@/lib/server/load-client-api-credentials";
import { invalidateClientCrmIntegrationCache } from "@/lib/server/load-client-crm-integration";
import { requireApiUser, sessionCanManageClientSecrets } from "@/lib/server/require-api-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ClientApiCredentials, ClientCrmIntegration } from "@/types";

type RouteCtx = { params: Promise<{ id: string }> };

async function loadClient(id: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("clients")
    .select("id,slug,api_credentials,crm_integration")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[clients/secrets] load failed:", error.message);
    return null;
  }
  return data as {
    id: string;
    slug: string;
    api_credentials?: unknown;
    crm_integration?: unknown;
  } | null;
}

export async function GET(request: Request, ctx: RouteCtx) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const client = await loadClient(id);
  if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  if (!sessionCanManageClientSecrets(auth.user, client.slug)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return NextResponse.json({
    apiCredentials: parseClientApiCredentials(client.api_credentials),
    crmIntegration: parseClientCrmIntegration(client.crm_integration),
  });
}

export async function PUT(request: Request, ctx: RouteCtx) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const client = await loadClient(id);
  if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  if (!sessionCanManageClientSecrets(auth.user, client.slug)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: { apiCredentials?: ClientApiCredentials; crmIntegration?: ClientCrmIntegration };
  try {
    body = (await request.json()) as {
      apiCredentials?: ClientApiCredentials;
      crmIntegration?: ClientCrmIntegration;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.apiCredentials) patch.api_credentials = clientApiCredentialsToDb(body.apiCredentials);
  if (body.crmIntegration) patch.crm_integration = clientCrmIntegrationToDb(body.crmIntegration);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("clients").update(patch).eq("id", id);
  if (error) {
    console.error("[clients/secrets] update failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  invalidateClientApiCredentialsCache(client.slug);
  invalidateClientCrmIntegrationCache(client.slug);
  return NextResponse.json({ ok: true });
}
