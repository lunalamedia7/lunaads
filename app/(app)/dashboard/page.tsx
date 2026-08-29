import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { hoursAgoIso, daysAgoIso } from "@/lib/time";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getDashboardSummary,
  getPaymentMethodBreakdown,
  getTopCampaigns,
  type Period,
} from "@/lib/dashboard";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { BalanceByBc, type BcBalanceRow } from "@/components/dashboard/balance-by-bc";
import { RecentTransactions, type SaleRow } from "@/components/dashboard/recent-transactions";
import { PaymentMethodsSection } from "@/components/dashboard/payment-methods-section";
import { TopCampaignsSection } from "@/components/dashboard/top-campaigns-section";
import { FunnelSection, type FunnelCounts } from "@/components/dashboard/funnel-section";
import {
  SystemStatusSection,
  type SystemStatusCounts,
  type ActivityItem,
} from "@/components/dashboard/system-status-section";
import { EmptyState } from "@/components/empty-state";
import { Moon } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime-refresh";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const VALID_PERIODS: Period[] = ["today", "yesterday", "7d", "30d"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const period: Period = VALID_PERIODS.includes(periodo as Period) ? (periodo as Period) : "today";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const org = await getCurrentOrg();

  const name =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    user?.email?.split("@")[0] ??
    "";

  if (!org) {
    return (
      <EmptyState
        icon={Moon}
        title="Não foi possível carregar sua organização"
        description="Tente atualizar a página."
      />
    );
  }

  const db = createServiceClient();

  const [
    summary,
    paymentMethods,
    topCampaigns,
    { data: connection },
    { data: businessCenters },
    { count: bcCount },
    { data: accounts },
    { data: recentSales },
    { data: activity },
    { data: recentDomains },
    { data: funnelEvents },
  ] = await Promise.all([
    getDashboardSummary(org.id, period),
    getPaymentMethodBreakdown(org.id, period),
    getTopCampaigns(org.id, period),
    db.from("tiktok_connections").select("status").eq("org_id", org.id).maybeSingle(),
    db
      .from("business_centers")
      .select("id, name, alias, currency, balance, can_read_finance, status")
      .eq("org_id", org.id)
      .order("name"),
    db.from("business_centers").select("id", { count: "exact", head: true }).eq("org_id", org.id),
    db
      .from("ad_accounts")
      .select("id, status, is_limited")
      .eq("org_id", org.id),
    db
      .from("sales")
      .select("id, platform, status, gross_amount, currency, occurred_at")
      .eq("org_id", org.id)
      .order("occurred_at", { ascending: false })
      .limit(20),
    db
      .from("audit_log")
      .select("id, action, created_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(10),
    db
      .from("tracking_domains")
      .select("id")
      .eq("org_id", org.id)
      .gte("last_seen_at", hoursAgoIso(48)),
    db
      .from("tracking_events")
      .select("event_type")
      .eq("org_id", org.id)
      .gte("occurred_at", daysAgoIso(30)),
  ]);

  const bcRows: BcBalanceRow[] = (businessCenters ?? []).map((bc) => ({
    id: bc.id,
    name: bc.alias || bc.name,
    currency: bc.currency,
    balance: bc.balance,
    canReadFinance: bc.can_read_finance,
    status: bc.status,
  }));

  const saleRows: SaleRow[] = (recentSales ?? []).map((sale) => ({
    id: sale.id,
    platform: sale.platform,
    status: sale.status,
    grossAmount: Number(sale.gross_amount),
    currency: sale.currency,
    occurredAt: sale.occurred_at,
  }));

  const systemCounts: SystemStatusCounts = {
    connectedAccounts: accounts?.length ?? 0,
    activeAccounts: (accounts ?? []).filter((a) => a.status === "active" && !a.is_limited).length,
    limitedAccounts: (accounts ?? []).filter((a) => a.is_limited).length,
    businessCenters: bcCount ?? 0,
  };

  const activityItems: ActivityItem[] = (activity ?? []).map((a) => ({
    id: a.id,
    action: a.action,
    createdAt: a.created_at,
  }));

  const todaysPaid = summary.paidCount;
  const todaysPending = summary.pendingCount;

  const pixelDetected = (recentDomains?.length ?? 0) > 0;
  const funnelCounts: FunnelCounts = {
    pageView: (funnelEvents ?? []).filter((e) => e.event_type === "PageView").length,
    viewContent: (funnelEvents ?? []).filter((e) => e.event_type === "ViewContent").length,
    initiateCheckout: (funnelEvents ?? []).filter((e) => e.event_type === "InitiateCheckout").length,
    salesInitiated: summary.paidCount + summary.pendingCount,
    salesPaid: summary.paidCount,
  };

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh orgId={org.id} tables={["daily_metrics", "business_centers"]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight text-foreground">
            {greeting()}
            {name ? `, ${name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Você teve {todaysPaid} venda{todaysPaid === 1 ? "" : "s"} · {todaysPending} pendente
            {todaysPending === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector value={period} />
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-muted hover:bg-secondary hover:text-foreground"
            aria-label="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${connection?.status === "connected" ? "bg-success" : "bg-text-faint"}`}
        />
        <span className="text-text-muted">
          {connection?.status === "connected"
            ? `TikTok Ads conectado · ${systemCounts.connectedAccounts} contas · ${systemCounts.businessCenters} BCs sincronizados`
            : "TikTok Ads não conectado"}
        </span>
        <a href="/integracoes" className="ml-auto text-xs font-medium text-primary hover:underline">
          Ver contas
        </a>
      </div>

      <KpiCards
        grossRevenue={summary.grossRevenue}
        spend={summary.spend}
        roi={summary.roi}
        profit={summary.profit}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevenueChart
          series={summary.series}
          title={summary.isSingleDay ? "Faturamento por hora" : "Faturamento por dia"}
        />
        <BalanceByBc rows={bcRows} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentTransactions key={period} orgId={org.id} initialSales={saleRows} />
        <FunnelSection pixelDetected={pixelDetected} counts={funnelCounts} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PaymentMethodsSection data={paymentMethods} />
        <TopCampaignsSection
          campaigns={topCampaigns.campaigns}
          unattributed={topCampaigns.unattributed}
          hasAnySale={topCampaigns.hasAnySale}
        />
      </div>

      <SystemStatusSection counts={systemCounts} activity={activityItems} />
    </div>
  );
}
