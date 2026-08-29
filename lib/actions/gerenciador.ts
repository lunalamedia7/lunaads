"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessToken } from "@/lib/tiktok/connection";
import { getTikTokProvider } from "@/lib/tiktok";

export type GerenciadorActionState = { error: string | null; success: string | null };

/**
 * PRECISA CONFIRMAR NA DOC: os valores mínimos reais de orçamento diário do
 * TikTok por moeda mudam com o tempo e variam por objetivo/nível (campanha
 * vs. conjunto). Os valores abaixo são uma referência aproximada — ajuste
 * antes de operar com contas reais.
 */
const MIN_DAILY_BUDGET: Record<string, number> = {
  BRL: 20,
  USD: 5,
  CLP: 4000,
};

async function recordAudit(orgId: string, action: string, payload: Record<string, unknown>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor_id: user?.id ?? null,
    action,
    entity: "campaign",
    payload,
  });
}

export async function bulkUpdateCampaignStatus(
  campaignRowIds: string[],
  status: "active" | "paused",
): Promise<GerenciadorActionState> {
  const org = await requireRole("operator");
  const db = createServiceClient();

  const { data: campaigns } = await db
    .from("campaigns")
    .select("id, tiktok_campaign_id, ad_accounts(advertiser_id)")
    .eq("org_id", org.id)
    .in("id", campaignRowIds);

  if (!campaigns || campaigns.length === 0) {
    return { error: "Nenhuma campanha encontrada.", success: null };
  }

  const accessToken = await getAccessToken(org.id);
  const provider = getTikTokProvider();

  const byAdvertiser = new Map<string, string[]>();
  for (const c of campaigns) {
    const account = Array.isArray(c.ad_accounts) ? c.ad_accounts[0] : c.ad_accounts;
    if (!account?.advertiser_id) continue;
    const list = byAdvertiser.get(account.advertiser_id) ?? [];
    list.push(c.tiktok_campaign_id);
    byAdvertiser.set(account.advertiser_id, list);
  }

  try {
    for (const [advertiserId, tiktokIds] of byAdvertiser) {
      await provider.updateCampaignStatus(accessToken, advertiserId, tiktokIds, status);
    }
  } catch {
    return { error: "Falha ao atualizar status no TikTok.", success: null };
  }

  await db
    .from("campaigns")
    .update({ status, updated_at: new Date().toISOString() })
    .in(
      "id",
      campaigns.map((c) => c.id),
    );

  await recordAudit(org.id, status === "active" ? "campaign.activated" : "campaign.paused", {
    count: campaigns.length,
    campaignIds: campaigns.map((c) => c.tiktok_campaign_id),
  });

  revalidatePath("/gerenciador");
  return { error: null, success: `${campaigns.length} campanha(s) atualizada(s).` };
}

export async function bulkUpdateAdGroupStatus(
  adGroupRowIds: string[],
  status: "active" | "paused",
): Promise<GerenciadorActionState> {
  const org = await requireRole("operator");
  const db = createServiceClient();

  const { data: adGroups } = await db
    .from("ad_groups")
    .select("id, tiktok_adgroup_id, campaigns(ad_accounts(advertiser_id))")
    .eq("org_id", org.id)
    .in("id", adGroupRowIds);

  if (!adGroups || adGroups.length === 0) {
    return { error: "Nenhum conjunto encontrado.", success: null };
  }

  const accessToken = await getAccessToken(org.id);
  const provider = getTikTokProvider();

  const byAdvertiser = new Map<string, string[]>();
  for (const ag of adGroups) {
    const campaign = Array.isArray(ag.campaigns) ? ag.campaigns[0] : ag.campaigns;
    const account = campaign
      ? Array.isArray(campaign.ad_accounts)
        ? campaign.ad_accounts[0]
        : campaign.ad_accounts
      : null;
    if (!account?.advertiser_id) continue;
    const list = byAdvertiser.get(account.advertiser_id) ?? [];
    list.push(ag.tiktok_adgroup_id);
    byAdvertiser.set(account.advertiser_id, list);
  }

  try {
    for (const [advertiserId, tiktokIds] of byAdvertiser) {
      await provider.updateAdGroupStatus(accessToken, advertiserId, tiktokIds, status);
    }
  } catch {
    return { error: "Falha ao atualizar status no TikTok.", success: null };
  }

  await db
    .from("ad_groups")
    .update({ status, updated_at: new Date().toISOString() })
    .in(
      "id",
      adGroups.map((a) => a.id),
    );

  await recordAudit(org.id, status === "active" ? "adgroup.activated" : "adgroup.paused", {
    count: adGroups.length,
  });

  revalidatePath("/gerenciador");
  return { error: null, success: `${adGroups.length} conjunto(s) atualizado(s).` };
}

export async function bulkUpdateAdGroupBudget(
  adGroupRowIds: string[],
  mode: "percent" | "fixed",
  value: number,
): Promise<GerenciadorActionState> {
  const org = await requireRole("operator");
  const db = createServiceClient();

  const { data: adGroups } = await db
    .from("ad_groups")
    .select("id, tiktok_adgroup_id, budget_amount, campaigns(ad_accounts(advertiser_id, currency))")
    .eq("org_id", org.id)
    .in("id", adGroupRowIds);

  if (!adGroups || adGroups.length === 0) {
    return { error: "Nenhum conjunto encontrado.", success: null };
  }

  const accessToken = await getAccessToken(org.id);
  const provider = getTikTokProvider();

  for (const ag of adGroups) {
    const campaign = Array.isArray(ag.campaigns) ? ag.campaigns[0] : ag.campaigns;
    const account = campaign
      ? Array.isArray(campaign.ad_accounts)
        ? campaign.ad_accounts[0]
        : campaign.ad_accounts
      : null;
    if (!account?.advertiser_id) continue;

    const currentBudget = Number(ag.budget_amount ?? 0);
    const newBudget =
      mode === "percent" ? Number((currentBudget * (1 + value / 100)).toFixed(2)) : value;

    const minBudget = MIN_DAILY_BUDGET[account.currency] ?? 0;
    if (newBudget < minBudget) {
      return {
        error: `O orçamento mínimo para contas em ${account.currency} é ${minBudget}. Um dos conjuntos ficaria abaixo disso.`,
        success: null,
      };
    }

    try {
      await provider.updateAdGroupBudget(accessToken, account.advertiser_id, ag.tiktok_adgroup_id, newBudget);
    } catch {
      return { error: "Falha ao atualizar orçamento no TikTok.", success: null };
    }

    await db
      .from("ad_groups")
      .update({ budget_amount: newBudget, updated_at: new Date().toISOString() })
      .eq("id", ag.id);
  }

  await recordAudit(org.id, "adgroup.budget_updated", { count: adGroups.length, mode, value });

  revalidatePath("/gerenciador");
  return { error: null, success: `Orçamento atualizado em ${adGroups.length} conjunto(s).` };
}
