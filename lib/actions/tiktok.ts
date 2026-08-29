"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole, getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { getTikTokProvider, tiktokOAuthAuthorizeUrl } from "@/lib/tiktok";
import { syncAll } from "@/lib/tiktok/sync";

export type TikTokActionState = { error: string | null; success: string | null };

async function recordAudit(orgId: string, action: string, entity: string, payload: Record<string, unknown>) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor_id: user?.id ?? null,
    action,
    entity,
    payload,
  });
}

export async function connectTikTok(): Promise<TikTokActionState> {
  const org = await requireRole("admin");
  const mode = process.env.TIKTOK_PROVIDER ?? "mock";

  if (mode === "http") {
    const state = `${org.id}:${randomUUID()}`;
    redirect(tiktokOAuthAuthorizeUrl(state));
  }

  const provider = getTikTokProvider();
  const tokenSet = await provider.exchangeCodeForToken(`mock-${org.id}`);

  const db = createServiceClient();
  await db.from("tiktok_connections").upsert(
    {
      org_id: org.id,
      tiktok_app_id: process.env.TIKTOK_APP_ID ?? "mock-app",
      access_token_enc: encrypt(tokenSet.accessToken),
      refresh_token_enc: tokenSet.refreshToken ? encrypt(tokenSet.refreshToken) : null,
      scopes: tokenSet.scopes,
      expires_at: tokenSet.expiresAt.toISOString(),
      status: "connected",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );

  await recordAudit(org.id, "tiktok.connected", "tiktok_connection", { mode });
  await syncAll(org.id);

  revalidatePath("/integracoes");
  revalidatePath("/business-centers");
  revalidatePath("/contas");
  return { error: null, success: "TikTok Ads conectado e sincronizado." };
}

export async function disconnectTikTok(): Promise<TikTokActionState> {
  const org = await requireRole("admin");
  const db = createServiceClient();
  await db.from("tiktok_connections").update({ status: "disconnected" }).eq("org_id", org.id);
  await recordAudit(org.id, "tiktok.disconnected", "tiktok_connection", {});
  revalidatePath("/integracoes");
  return { error: null, success: "TikTok Ads desconectado. O histórico de gasto e vendas foi mantido." };
}

export async function syncTikTokNow(): Promise<TikTokActionState> {
  const org = await getCurrentOrg();
  if (!org) return { error: "Sessão inválida.", success: null };

  try {
    const result = await syncAll(org.id);
    revalidatePath("/integracoes");
    revalidatePath("/business-centers");
    revalidatePath("/contas");
    return {
      error: null,
      success: `Sincronizado: ${result.businessCenters} Business Centers, ${result.adAccounts} contas.`,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "TikTokNeedsReauthError") {
      revalidatePath("/integracoes");
      return { error: "Conexão expirou. Reconecte o TikTok Ads.", success: null };
    }
    return { error: "Falha ao sincronizar. Tente novamente em instantes.", success: null };
  }
}
