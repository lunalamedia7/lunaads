import { Wallet } from "lucide-react";
import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { EmptyState } from "@/components/empty-state";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ContasView, type ContaRow } from "@/components/contas/contas-view";

export default async function ContasPage() {
  const org = await getCurrentOrg();

  if (!org) {
    return <EmptyState icon={Wallet} title="Não foi possível carregar sua organização" />;
  }

  const db = createServiceClient();
  const [{ data: accounts }, { data: businessCenters }] = await Promise.all([
    db
      .from("ad_accounts")
      .select(
        "id, advertiser_id, name, currency, status, is_limited, can_read_finance, balance, business_center_id, business_centers(name, alias)",
      )
      .eq("org_id", org.id)
      .order("advertiser_id"),
    db.from("business_centers").select("id, name, alias").eq("org_id", org.id).order("name"),
  ]);

  const rows: ContaRow[] = (accounts ?? []).map((account) => {
    const bc = Array.isArray(account.business_centers)
      ? account.business_centers[0]
      : account.business_centers;
    return {
      id: account.id,
      advertiserId: account.advertiser_id,
      name: account.name,
      currency: account.currency,
      status: account.status,
      isLimited: account.is_limited,
      canReadFinance: account.can_read_finance,
      balance: account.balance,
      bcId: account.business_center_id,
      bcName: bc?.alias || bc?.name || "—",
    };
  });

  const bcOptions = (businessCenters ?? []).map((bc) => ({
    id: bc.id,
    name: bc.alias || bc.name,
  }));

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh orgId={org.id} tables={["ad_accounts", "business_centers"]} />
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Contas</h1>
        <p className="mt-1 text-sm text-text-muted">Todas as suas contas de anúncio, em um só lugar.</p>
      </div>
      <ContasView accounts={rows} businessCenters={bcOptions} />
    </div>
  );
}
