import { Building } from "lucide-react";
import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { EmptyState } from "@/components/empty-state";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { BusinessCentersView } from "@/components/business-centers/business-centers-view";
import type { BusinessCenterCardData } from "@/components/business-centers/business-center-card";

export default async function BusinessCentersPage() {
  const org = await getCurrentOrg();

  if (!org) {
    return <EmptyState icon={Building} title="Não foi possível carregar sua organização" />;
  }

  const db = createServiceClient();
  const [{ data: businessCenters }, { data: accounts }] = await Promise.all([
    db
      .from("business_centers")
      .select("id, bc_id, name, alias, company_name, currency, status, can_read_finance, balance")
      .eq("org_id", org.id)
      .order("name"),
    db.from("ad_accounts").select("business_center_id").eq("org_id", org.id),
  ]);

  const countByBc = new Map<string, number>();
  for (const account of accounts ?? []) {
    countByBc.set(account.business_center_id, (countByBc.get(account.business_center_id) ?? 0) + 1);
  }
  const totalAccounts = accounts?.length ?? 0;

  const cards: BusinessCenterCardData[] = (businessCenters ?? []).map((bc) => ({
    id: bc.id,
    bcId: bc.bc_id,
    name: bc.name,
    alias: bc.alias,
    companyName: bc.company_name,
    currency: bc.currency,
    status: bc.status,
    canReadFinance: bc.can_read_finance,
    balance: bc.balance,
    accountCount: countByBc.get(bc.id) ?? 0,
    totalAccounts,
  }));

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh orgId={org.id} tables={["business_centers", "ad_accounts"]} />
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Business Centers</h1>
        <p className="mt-1 text-sm text-text-muted">Saldo e status de cada BC conectado.</p>
      </div>
      <BusinessCentersView businessCenters={cards} />
    </div>
  );
}
