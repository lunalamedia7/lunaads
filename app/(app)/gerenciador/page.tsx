import { ListChecks } from "lucide-react";
import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { EmptyState } from "@/components/empty-state";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { GerenciadorView, type CampaignRow } from "@/components/gerenciador/gerenciador-view";

export default async function GerenciadorPage() {
  const org = await getCurrentOrg();
  if (!org) return <EmptyState icon={ListChecks} title="Não foi possível carregar sua organização" />;

  const db = createServiceClient();

  const [{ data: campaignsRaw }, { data: businessCenters }, { data: attributedSales }] = await Promise.all([
    db
      .from("campaigns")
      .select(
        "id, name, status, objective, budget_amount, spend, impressions, clicks, conversions, tiktok_campaign_id, ad_accounts(name, currency, business_centers(name, alias)), ad_groups(id, name, status, budget_mode, budget_amount)",
      )
      .eq("org_id", org.id)
      .order("created_at", { ascending: false }),
    db.from("business_centers").select("id, name, alias").eq("org_id", org.id),
    db
      .from("sales")
      .select("utm_campaign, gross_amount")
      .eq("org_id", org.id)
      .eq("status", "paid")
      .not("utm_campaign", "is", null),
  ]);

  const revenueByCampaign = new Map<string, number>();
  for (const sale of attributedSales ?? []) {
    if (!sale.utm_campaign) continue;
    revenueByCampaign.set(
      sale.utm_campaign,
      (revenueByCampaign.get(sale.utm_campaign) ?? 0) + Number(sale.gross_amount),
    );
  }

  const campaigns: CampaignRow[] = (campaignsRaw ?? []).map((c) => {
    const account = Array.isArray(c.ad_accounts) ? c.ad_accounts[0] : c.ad_accounts;
    const bc = account?.business_centers
      ? Array.isArray(account.business_centers)
        ? account.business_centers[0]
        : account.business_centers
      : null;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      budgetAmount: c.budget_amount,
      spend: c.spend,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      attributedRevenue: revenueByCampaign.get(c.tiktok_campaign_id) ?? 0,
      currency: account?.currency ?? "BRL",
      accountName: account?.name ?? "—",
      bcName: bc?.alias || bc?.name || "—",
      adGroups: (c.ad_groups ?? []).map((ag) => ({
        id: ag.id,
        name: ag.name,
        status: ag.status,
        budgetMode: ag.budget_mode,
        budgetAmount: ag.budget_amount,
      })),
    };
  });

  const bcOptions = (businessCenters ?? []).map((bc) => ({ id: bc.id, name: bc.alias || bc.name }));

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh orgId={org.id} tables={["campaigns", "ad_groups"]} />
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Gerenciador</h1>
        <p className="mt-1 text-sm text-text-muted">
          Controle campanhas, conjuntos e anúncios já publicados.
        </p>
      </div>
      <GerenciadorView campaigns={campaigns} bcOptions={bcOptions} />
    </div>
  );
}
