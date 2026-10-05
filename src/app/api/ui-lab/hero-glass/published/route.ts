import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  HERO_GLASS_COMPONENT_KEY,
  PUBLISHED_HERO_GLASS,
  PUBLISHED_UI_LAB_USER_ID,
  parseHeroGlassConfig,
} from "@/lib/ui-lab/hero-glass";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin().from("ui_lab_drafts")
      .select("config,updated_at")
      .eq("user_id", PUBLISHED_UI_LAB_USER_ID)
      .eq("component_key", HERO_GLASS_COMPONENT_KEY)
      .maybeSingle();
    if (error) throw error;
    return Response.json({
      config: parseHeroGlassConfig(data?.config) ?? PUBLISHED_HERO_GLASS,
      publishedAt: data?.updated_at ?? null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ config: PUBLISHED_HERO_GLASS, publishedAt: null }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
