import { z } from "zod";

export const METRIC_OPTIONS = [
  { value: "spend", label: "Gasto" },
  { value: "cpa", label: "CPA" },
  { value: "ctr", label: "CTR (%)" },
  { value: "cpc", label: "CPC" },
  { value: "cpm", label: "CPM" },
  { value: "conversions", label: "Conversões" },
  { value: "roi", label: "ROI" },
] as const;

export const OPERATOR_OPTIONS = [
  { value: "gt", label: "maior que" },
  { value: "lt", label: "menor que" },
  { value: "gte", label: "maior ou igual a" },
  { value: "lte", label: "menor ou igual a" },
] as const;

export const ACTION_TYPES = [
  { value: "pause", label: "Pausar campanha" },
  { value: "activate", label: "Ativar campanha" },
  { value: "budget_change", label: "Alterar orçamento" },
  { value: "notify", label: "Só notificar" },
] as const;

export const SCOPE_TYPES = [
  { value: "all", label: "Todas as campanhas" },
  { value: "account", label: "Contas específicas" },
  { value: "bc", label: "Business Centers específicos" },
] as const;

const metricValues = METRIC_OPTIONS.map((m) => m.value) as [string, ...string[]];
const operatorValues = OPERATOR_OPTIONS.map((o) => o.value) as [string, ...string[]];
const actionValues = ACTION_TYPES.map((a) => a.value) as [string, ...string[]];
const scopeValues = SCOPE_TYPES.map((s) => s.value) as [string, ...string[]];

export const ruleFormSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome para a regra."),
  triggerType: z.literal("interval").default("interval"),
  intervalMinutes: z.coerce.number().min(15, "Mínimo de 15 minutos entre execuções.").default(60),
  metric: z.enum(metricValues),
  operator: z.enum(operatorValues),
  value: z.coerce.number(),
  minConversions: z.coerce.number().optional().default(0),
  actionType: z.enum(actionValues),
  budgetChangePercent: z.coerce.number().optional(),
  scopeType: z.enum(scopeValues).default("all"),
  scopeIds: z.array(z.string()).optional().default([]),
  maxActionsPerRun: z.coerce.number().min(1).max(200).default(20),
  cooldownMinutes: z.coerce.number().min(0).default(60),
  maxBudgetChangePercentPerDay: z.coerce.number().min(0).default(20),
});

export type RuleFormData = z.infer<typeof ruleFormSchema>;

export type RuleCondition = {
  metric: string;
  operator: string;
  value: number;
  minConversions: number;
};

export type RuleAction = {
  type: string;
  budgetChangePercent?: number;
};

export type RuleScope = {
  type: string;
  ids: string[];
};

export function evaluateCondition(
  condition: RuleCondition,
  metrics: { value: number; conversions: number },
): boolean {
  if (metrics.conversions < condition.minConversions) return false;
  switch (condition.operator) {
    case "gt":
      return metrics.value > condition.value;
    case "lt":
      return metrics.value < condition.value;
    case "gte":
      return metrics.value >= condition.value;
    case "lte":
      return metrics.value <= condition.value;
    default:
      return false;
  }
}

export function computeMetricValue(
  metric: string,
  campaign: {
    spend: number | null;
    impressions: number | null;
    clicks: number | null;
    conversions: number | null;
    attributedRevenue: number;
  },
): number {
  const spend = campaign.spend ?? 0;
  const impressions = campaign.impressions ?? 0;
  const clicks = campaign.clicks ?? 0;
  const conversions = campaign.conversions ?? 0;

  switch (metric) {
    case "spend":
      return spend;
    case "cpa":
      return conversions > 0 ? spend / conversions : 0;
    case "ctr":
      return impressions > 0 ? (clicks / impressions) * 100 : 0;
    case "cpc":
      return clicks > 0 ? spend / clicks : 0;
    case "cpm":
      return impressions > 0 ? (spend / impressions) * 1000 : 0;
    case "conversions":
      return conversions;
    case "roi":
      return spend > 0 ? campaign.attributedRevenue / spend : 0;
    default:
      return 0;
  }
}
