import { resolveMetaCredentials, type ResolvedMetaCredentials } from "@/lib/client-api-credentials";
import {
  clientSlugFromRequest,
  loadClientApiCredentials,
} from "@/lib/server/load-client-api-credentials";

export async function metaFromRequest(
  request: Request,
  sessionSlug?: string | null,
): Promise<ResolvedMetaCredentials> {
  const slug = clientSlugFromRequest(request) || sessionSlug?.trim() || null;
  const stored = await loadClientApiCredentials(slug);
  // A specific client must use its own tokens. Falling back to server .env
  // mixed RocketRide credentials into IFY and hid a valid client token.
  if (slug) {
    const accessToken = stored?.metaAccessToken?.trim() || "";
    const adAccountId = (stored?.metaAdAccountId ?? "").replace(/^act_/i, "").trim();
    const instagramId = stored?.metaInstagramId?.trim() || "";
    return {
      accessToken,
      adAccountId,
      instagramId,
      configured: Boolean(accessToken && adAccountId),
    };
  }
  return resolveMetaCredentials(stored);
}

export function instagramConfigured(meta: ResolvedMetaCredentials): boolean {
  return Boolean(meta.accessToken && meta.instagramId);
}
