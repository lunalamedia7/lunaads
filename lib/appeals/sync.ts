import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessToken } from "@/lib/tiktok/connection";
import { getTikTokProvider } from "@/lib/tiktok";
import { notifyOrg } from "@/lib/notifications";

export async function syncRejections(orgId: string): Promise<{ found: number }> {
  const db = createServiceClient();
  const accessToken = await getAccessToken(orgId);
  const provider = getTikTokProvider();

  const [{ data: ads }, { data: adGroups }, { data: campaigns }, { data: accounts }, { data: businessCenters }] =
    await Promise.all([
      db.from("ads").select("id, tiktok_ad_id, name, ad_group_id").eq("org_id", orgId),
      db.from("ad_groups").select("id, tiktok_adgroup_id, campaign_id").eq("org_id", orgId),
      db.from("campaigns").select("id, tiktok_campaign_id, ad_account_id").eq("org_id", orgId),
      db.from("ad_accounts").select("id, advertiser_id, business_center_id").eq("org_id", orgId),
      db.from("business_centers").select("id, bc_id").eq("org_id", orgId),
    ]);

  if (!ads || ads.length === 0) return { found: 0 };

  const adGroupById = new Map((adGroups ?? []).map((a) => [a.id, a]));
  const campaignById = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const bcById = new Map((businessCenters ?? []).map((b) => [b.id, b]));

  const byAdvertiser = new Map<
    string,
    { adRowId: string; tiktokAdId: string; adName: string; tiktokAdgroupId: string; tiktokCampaignId: string; bcId: string | null }[]
  >();

  for (const ad of ads) {
    const adGroup = ad.ad_group_id ? adGroupById.get(ad.ad_group_id) : null;
    const campaign = adGroup ? campaignById.get(adGroup.campaign_id) : null;
    const account = campaign ? accountById.get(campaign.ad_account_id) : null;
    if (!adGroup || !campaign || !account) continue;
    const bc = account.business_center_id ? bcById.get(account.business_center_id) : null;

    const list = byAdvertiser.get(account.advertiser_id) ?? [];
    list.push({
      adRowId: ad.id,
      tiktokAdId: ad.tiktok_ad_id,
      adName: ad.name,
      tiktokAdgroupId: adGroup.tiktok_adgroup_id,
      tiktokCampaignId: campaign.tiktok_campaign_id,
      bcId: bc?.bc_id ?? null,
    });
    byAdvertiser.set(account.advertiser_id, list);
  }

  let found = 0;
  for (const [advertiserId, list] of byAdvertiser) {
    const statuses = await provider.checkAdReviewStatus(
      accessToken,
      advertiserId,
      list.map((a) => a.tiktokAdId),
    );

    for (const item of list) {
      const status = statuses[item.tiktokAdId];
      await db
        .from("ads")
        .update({ review_checked_at: new Date().toISOString() })
        .eq("id", item.adRowId);

      if (!status?.rejected) continue;
      found += 1;

      await db.from("ads").update({
        is_smart_plus: status.isSmartPlus,
        reject_reason: status.rejectReason,
      }).eq("id", item.adRowId);

      const { data: inserted } = await db
        .from("appeals")
        .upsert(
          {
            org_id: orgId,
            ad_id: item.adRowId,
            bc_id: item.bcId,
            advertiser_id: advertiserId,
            tiktok_campaign_id: item.tiktokCampaignId,
            tiktok_adgroup_id: item.tiktokAdgroupId,
            tiktok_ad_id: item.tiktokAdId,
            ad_name: item.adName,
            reject_reason: status.rejectReason,
            strategy: status.isSmartPlus ? "api" : "assisted",
          },
          { onConflict: "org_id,tiktok_ad_id", ignoreDuplicates: true },
        )
        .select("id");

      // ignoreDuplicates faz upsert().select() retornar vazio quando a linha
      // já existia — só notifica quando é uma reprovação genuinamente nova.
      if (inserted && inserted.length > 0) {
        await notifyOrg(orgId, {
          type: "criativo_reprovado",
          title: "Anúncio reprovado pelo TikTok",
          body: `${item.adName}: ${status.rejectReason ?? "motivo não informado"}.`,
          link: "/apelacoes",
        });
      }
    }
  }

  return { found };
}
