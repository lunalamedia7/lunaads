import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessToken } from "@/lib/tiktok/connection";
import { getTikTokProvider } from "@/lib/tiktok";

/**
 * Atualiza as métricas cacheadas das campanhas de uma org. Em modo mock,
 * gera números plausíveis; em modo http, lança erro (endpoint de relatório
 * ainda não confirmado — ver lib/tiktok/http-provider.ts).
 */
export async function syncCampaignMetrics(orgId: string): Promise<{ updated: number }> {
  const db = createServiceClient();
  const provider = getTikTokProvider();

  const { data: campaigns } = await db
    .from("campaigns")
    .select("id, tiktok_campaign_id, ad_account_id, ad_accounts(advertiser_id)")
    .eq("org_id", orgId);

  if (!campaigns || campaigns.length === 0) return { updated: 0 };

  const accessToken = await getAccessToken(orgId);
  const byAdvertiser = new Map<string, { rowId: string; tiktokId: string }[]>();

  for (const campaign of campaigns) {
    const account = Array.isArray(campaign.ad_accounts) ? campaign.ad_accounts[0] : campaign.ad_accounts;
    const advertiserId = account?.advertiser_id;
    if (!advertiserId) continue;
    const list = byAdvertiser.get(advertiserId) ?? [];
    list.push({ rowId: campaign.id, tiktokId: campaign.tiktok_campaign_id });
    byAdvertiser.set(advertiserId, list);
  }

  let updated = 0;
  for (const [advertiserId, rows] of byAdvertiser) {
    try {
      const metrics = await provider.getMetrics(
        accessToken,
        advertiserId,
        rows.map((r) => r.tiktokId),
      );
      for (const row of rows) {
        const m = metrics[row.tiktokId];
        if (!m) continue;
        await db
          .from("campaigns")
          .update({
            spend: m.spend,
            impressions: m.impressions,
            clicks: m.clicks,
            conversions: m.conversions,
            metrics_updated_at: new Date().toISOString(),
          })
          .eq("id", row.rowId);
        updated += 1;
      }
    } catch {
      // provider pode não suportar métricas ainda (ex.: http sem endpoint confirmado).
    }
  }

  return { updated };
}
