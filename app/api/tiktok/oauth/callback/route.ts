import { NextResponse } from "next/server";
import { getTikTokProvider } from "@/lib/tiktok";
import { syncAll } from "@/lib/tiktok/sync";
import { createServiceClient } from "@/lib/supabase/service";
import { encrypt } from "@/lib/crypto";

/**
 * Callback do OAuth do TikTok Ads (só usado com TIKTOK_PROVIDER=http).
 * PRECISA CONFIRMAR NA DOC: o nome exato dos query params que o TikTok
 * manda de volta (assumido aqui como `auth_code` + `state`, com fallback
 * para `code`, seguindo o padrão mais comum da Marketing API).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const authCode = searchParams.get("auth_code") ?? searchParams.get("code");
  const state = searchParams.get("state");

  if (!authCode || !state) {
    return NextResponse.redirect(`${origin}/integracoes?error=missing_auth_code`);
  }

  const [orgId] = state.split(":");
  if (!orgId) {
    return NextResponse.redirect(`${origin}/integracoes?error=invalid_state`);
  }

  try {
    const provider = getTikTokProvider();
    const tokenSet = await provider.exchangeCodeForToken(authCode);

    const db = createServiceClient();
    await db.from("tiktok_connections").upsert(
      {
        org_id: orgId,
        tiktok_app_id: process.env.TIKTOK_APP_ID ?? "",
        access_token_enc: encrypt(tokenSet.accessToken),
        refresh_token_enc: tokenSet.refreshToken ? encrypt(tokenSet.refreshToken) : null,
        scopes: tokenSet.scopes,
        expires_at: tokenSet.expiresAt.toISOString(),
        status: "connected",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" },
    );

    await syncAll(orgId);
    return NextResponse.redirect(`${origin}/integracoes?connected=1`);
  } catch {
    return NextResponse.redirect(`${origin}/integracoes?error=oauth_failed`);
  }
}
