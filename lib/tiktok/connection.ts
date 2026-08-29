import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { encrypt, decrypt } from "@/lib/crypto";
import { getTikTokProvider } from "@/lib/tiktok";

const REFRESH_MARGIN_MS = 10 * 60 * 1000;

export class TikTokNeedsReauthError extends Error {
  constructor() {
    super("Conexão com o TikTok Ads precisa ser refeita.");
    this.name = "TikTokNeedsReauthError";
  }
}

export async function getAccessToken(orgId: string): Promise<string> {
  const db = createServiceClient();
  const { data: connection, error } = await db
    .from("tiktok_connections")
    .select("access_token_enc, refresh_token_enc, expires_at, status")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !connection || connection.status === "disconnected") {
    throw new TikTokNeedsReauthError();
  }

  if (connection.status === "needs_reauth") {
    throw new TikTokNeedsReauthError();
  }

  const expiresAt = new Date(connection.expires_at).getTime();
  const isExpiringSoon = expiresAt - Date.now() < REFRESH_MARGIN_MS;

  if (!isExpiringSoon) {
    return decrypt(connection.access_token_enc);
  }

  if (!connection.refresh_token_enc) {
    await db.from("tiktok_connections").update({ status: "needs_reauth" }).eq("org_id", orgId);
    throw new TikTokNeedsReauthError();
  }

  try {
    const provider = getTikTokProvider();
    const refreshed = await provider.refreshToken(decrypt(connection.refresh_token_enc));
    await db
      .from("tiktok_connections")
      .update({
        access_token_enc: encrypt(refreshed.accessToken),
        refresh_token_enc: refreshed.refreshToken ? encrypt(refreshed.refreshToken) : null,
        expires_at: refreshed.expiresAt.toISOString(),
        status: "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId);
    return refreshed.accessToken;
  } catch {
    await db.from("tiktok_connections").update({ status: "needs_reauth" }).eq("org_id", orgId);
    throw new TikTokNeedsReauthError();
  }
}
