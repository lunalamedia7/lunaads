import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export type Period = "today" | "yesterday" | "7d" | "30d";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
};

export function periodLabel(period: Period): string {
  return PERIOD_LABELS[period];
}

function todayInOrgTimezone(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function getDateRange(period: Period): { start: string; end: string; isSingleDay: boolean } {
  const today = todayInOrgTimezone();
  switch (period) {
    case "today":
      return { start: today, end: today, isSingleDay: true };
    case "yesterday": {
      const y = addDays(today, -1);
      return { start: y, end: y, isSingleDay: true };
    }
    case "7d":
      return { start: addDays(today, -6), end: today, isSingleDay: false };
    case "30d":
      return { start: addDays(today, -29), end: today, isSingleDay: false };
  }
}

export type TimeSeriesPoint = { label: string; revenue: number; spend: number };

export type DashboardSummary = {
  period: Period;
  grossRevenue: number;
  spend: number;
  roi: number | null;
  profit: number;
  paidCount: number;
  pendingCount: number;
  series: TimeSeriesPoint[];
  isSingleDay: boolean;
};

export async function getDashboardSummary(orgId: string, period: Period): Promise<DashboardSummary> {
  const db = createServiceClient();
  const { start, end, isSingleDay } = getDateRange(period);

  const { data: rows } = await db
    .from("daily_metrics")
    .select("metric_date, metric_hour, gross_revenue, paid_count, pending_count")
    .eq("org_id", orgId)
    .gte("metric_date", start)
    .lte("metric_date", end);

  const grossRevenue = (rows ?? []).reduce((sum, r) => sum + Number(r.gross_revenue), 0);
  const paidCount = (rows ?? []).reduce((sum, r) => sum + r.paid_count, 0);
  const pendingCount = (rows ?? []).reduce((sum, r) => sum + r.pending_count, 0);

  // Gasto ainda não é sincronizado (endpoint de relatório do TikTok pendente
  // de confirmação — ver Fase 8). Até lá, permanece honesto em zero.
  const spend = 0;
  const roi = spend > 0 ? grossRevenue / spend : null;
  const profit = grossRevenue - spend;

  let series: TimeSeriesPoint[];
  if (isSingleDay) {
    const byHour = new Map<number, number>();
    for (const r of rows ?? []) byHour.set(r.metric_hour, Number(r.gross_revenue));
    series = Array.from({ length: 24 }, (_, hour) => ({
      label: `${String(hour).padStart(2, "0")}h`,
      revenue: byHour.get(hour) ?? 0,
      spend: 0,
    }));
  } else {
    const byDate = new Map<string, number>();
    for (const r of rows ?? []) {
      byDate.set(r.metric_date, (byDate.get(r.metric_date) ?? 0) + Number(r.gross_revenue));
    }
    const days = Math.round(
      (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    series = Array.from({ length: days + 1 }, (_, i) => {
      const date = addDays(start, i);
      return {
        label: date.slice(5).split("-").reverse().join("/"),
        revenue: byDate.get(date) ?? 0,
        spend: 0,
      };
    });
  }

  return { period, grossRevenue, spend, roi, profit, paidCount, pendingCount, series, isSingleDay };
}

export type PaymentMethodBreakdown = {
  method: string;
  paidCount: number;
  attemptCount: number;
  approvalRate: number | null;
  grossRevenue: number;
};

export async function getPaymentMethodBreakdown(
  orgId: string,
  period: Period,
): Promise<PaymentMethodBreakdown[]> {
  const db = createServiceClient();
  const { start, end } = getDateRange(period);

  const { data } = await db
    .from("sales")
    .select("payment_method, status, gross_amount, occurred_at")
    .eq("org_id", orgId)
    .gte("occurred_at", `${start}T00:00:00-03:00`)
    .lt("occurred_at", `${addDays(end, 1)}T00:00:00-03:00`);

  const byMethod = new Map<string, { paid: number; attempts: number; revenue: number }>();
  for (const sale of data ?? []) {
    const method = sale.payment_method ?? "outro";
    const entry = byMethod.get(method) ?? { paid: 0, attempts: 0, revenue: 0 };
    entry.attempts += 1;
    if (sale.status === "paid") {
      entry.paid += 1;
      entry.revenue += Number(sale.gross_amount);
    }
    byMethod.set(method, entry);
  }

  return Array.from(byMethod.entries()).map(([method, v]) => ({
    method,
    paidCount: v.paid,
    attemptCount: v.attempts,
    approvalRate: v.attempts > 0 ? v.paid / v.attempts : null,
    grossRevenue: v.revenue,
  }));
}

export type CampaignAttribution = {
  campaign: string;
  grossRevenue: number;
  paidCount: number;
  percentOfTotal: number;
};

export async function getTopCampaigns(orgId: string, period: Period): Promise<{
  campaigns: CampaignAttribution[];
  unattributed: { grossRevenue: number; percentOfTotal: number };
  hasAnySale: boolean;
}> {
  const db = createServiceClient();
  const { start, end } = getDateRange(period);

  const { data } = await db
    .from("sales")
    .select("utm_campaign, gross_amount, status, occurred_at")
    .eq("org_id", orgId)
    .eq("status", "paid")
    .gte("occurred_at", `${start}T00:00:00-03:00`)
    .lt("occurred_at", `${addDays(end, 1)}T00:00:00-03:00`);

  const byCampaign = new Map<string, { revenue: number; count: number }>();
  let unattributedRevenue = 0;
  let total = 0;

  for (const sale of data ?? []) {
    const amount = Number(sale.gross_amount);
    total += amount;
    if (!sale.utm_campaign) {
      unattributedRevenue += amount;
      continue;
    }
    const entry = byCampaign.get(sale.utm_campaign) ?? { revenue: 0, count: 0 };
    entry.revenue += amount;
    entry.count += 1;
    byCampaign.set(sale.utm_campaign, entry);
  }

  const campaigns = Array.from(byCampaign.entries())
    .map(([campaign, v]) => ({
      campaign,
      grossRevenue: v.revenue,
      paidCount: v.count,
      percentOfTotal: total > 0 ? (v.revenue / total) * 100 : 0,
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);

  return {
    campaigns,
    unattributed: {
      grossRevenue: unattributedRevenue,
      percentOfTotal: total > 0 ? (unattributedRevenue / total) * 100 : 0,
    },
    hasAnySale: total > 0 || (data?.length ?? 0) > 0,
  };
}
