import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessToken } from "@/lib/tiktok/connection";
import { getTikTokProvider } from "@/lib/tiktok";
import { computeMetricValue, evaluateCondition, type RuleAction, type RuleCondition, type RuleScope } from "@/lib/automations/schema";
import { notifyOrg } from "@/lib/notifications";

type CampaignForRule = {
  id: string;
  tiktokCampaignId: string;
  name: string;
  status: string;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  attributedRevenue: number;
  advertiserId: string;
  adAccountId: string;
  bcRowId: string | null;
  adGroupIds: string[];
  adGroupTiktokIds: string[];
  adGroupBudgets: number[];
};

async function loadCampaignsForOrg(orgId: string): Promise<CampaignForRule[]> {
  const db = createServiceClient();
  const [{ data: campaigns }, { data: adGroups }, { data: accounts }, { data: sales }] = await Promise.all([
    db.from("campaigns").select("id, tiktok_campaign_id, name, status, spend, impressions, clicks, conversions, ad_account_id").eq("org_id", orgId),
    db.from("ad_groups").select("id, tiktok_adgroup_id, campaign_id, budget_amount").eq("org_id", orgId),
    db.from("ad_accounts").select("id, advertiser_id, business_center_id").eq("org_id", orgId),
    db.from("sales").select("utm_campaign, gross_amount").eq("org_id", orgId).eq("status", "paid").not("utm_campaign", "is", null),
  ]);

  const revenueByCampaign = new Map<string, number>();
  for (const sale of sales ?? []) {
    if (!sale.utm_campaign) continue;
    revenueByCampaign.set(sale.utm_campaign, (revenueByCampaign.get(sale.utm_campaign) ?? 0) + Number(sale.gross_amount));
  }

  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const adGroupsByCampaign = new Map<string, { id: string; tiktok_adgroup_id: string; budget_amount: number | null }[]>();
  for (const ag of adGroups ?? []) {
    const list = adGroupsByCampaign.get(ag.campaign_id) ?? [];
    list.push(ag);
    adGroupsByCampaign.set(ag.campaign_id, list);
  }

  return (campaigns ?? []).flatMap((c) => {
    const account = accountById.get(c.ad_account_id);
    if (!account) return [];
    const groups = adGroupsByCampaign.get(c.id) ?? [];
    return [
      {
        id: c.id,
        tiktokCampaignId: c.tiktok_campaign_id,
        name: c.name,
        status: c.status,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
        attributedRevenue: revenueByCampaign.get(c.tiktok_campaign_id) ?? 0,
        advertiserId: account.advertiser_id,
        adAccountId: account.id,
        bcRowId: account.business_center_id,
        adGroupIds: groups.map((g) => g.id),
        adGroupTiktokIds: groups.map((g) => g.tiktok_adgroup_id),
        adGroupBudgets: groups.map((g) => Number(g.budget_amount ?? 0)),
      },
    ];
  });
}

function matchesScope(campaign: CampaignForRule, scope: RuleScope): boolean {
  if (scope.type === "all") return true;
  if (scope.type === "account") return scope.ids.includes(campaign.adAccountId);
  if (scope.type === "bc") return campaign.bcRowId !== null && scope.ids.includes(campaign.bcRowId);
  return false;
}

export async function runDueAutomations(): Promise<{ rulesRun: number }> {
  const db = createServiceClient();
  const { data: rules } = await db.from("automation_rules").select("*").eq("is_active", true);

  let rulesRun = 0;
  for (const rule of rules ?? []) {
    const intervalMinutes = (rule.trigger_config as { intervalMinutes?: number })?.intervalMinutes ?? 60;
    if (rule.last_run_at) {
      const elapsedMinutes = (Date.now() - new Date(rule.last_run_at).getTime()) / 60000;
      if (elapsedMinutes < intervalMinutes) continue;
    }
    await runRule(rule);
    rulesRun += 1;
  }
  return { rulesRun };
}

export async function runRule(rule: {
  id: string;
  org_id: string;
  name: string;
  condition: unknown;
  action: unknown;
  scope: unknown;
  is_dry_run: boolean;
  max_actions_per_run: number;
  cooldown_minutes: number;
  max_budget_change_percent_per_day: number;
}): Promise<void> {
  const db = createServiceClient();
  const condition = rule.condition as RuleCondition;
  const action = rule.action as RuleAction;
  const scope = rule.scope as RuleScope;

  const { data: run } = await db
    .from("automation_runs")
    .insert({ org_id: rule.org_id, rule_id: rule.id })
    .select("id")
    .single();
  if (!run) return;

  let actionsTaken = 0;
  let hadError = false;

  try {
    const campaigns = await loadCampaignsForOrg(rule.org_id);
    const inScope = campaigns.filter((c) => matchesScope(c, scope));

    for (const campaign of inScope) {
      if (actionsTaken >= rule.max_actions_per_run) {
        await logDecision(run.id, rule.org_id, rule.id, campaign, "skipped_guardrail", null, null, null, "ok");
        continue;
      }

      const metricValue = computeMetricValue(condition.metric, campaign);
      const conditionMet = evaluateCondition(condition, {
        value: metricValue,
        conversions: campaign.conversions ?? 0,
      });

      if (!conditionMet) {
        await logDecision(run.id, rule.org_id, rule.id, campaign, "skipped_condition", null, null, null, "ok");
        continue;
      }

      const onCooldown = await isOnCooldown(rule.id, campaign.id, rule.cooldown_minutes);
      if (onCooldown) {
        await logDecision(run.id, rule.org_id, rule.id, campaign, "skipped_cooldown", null, null, null, "ok");
        continue;
      }

      if (action.type === "budget_change") {
        const changedTodayPercent = await budgetChangedTodayPercent(rule.id, campaign.id);
        if (Math.abs(changedTodayPercent) + Math.abs(action.budgetChangePercent ?? 0) > rule.max_budget_change_percent_per_day) {
          await logDecision(run.id, rule.org_id, rule.id, campaign, "skipped_guardrail", null, null, null, "ok");
          continue;
        }
      }

      if (rule.is_dry_run) {
        await logDecision(
          run.id,
          rule.org_id,
          rule.id,
          campaign,
          "would_act",
          action.type,
          { status: campaign.status, budgets: campaign.adGroupBudgets },
          null,
          "dry_run",
        );
        continue;
      }

      try {
        const after = await executeAction(rule.org_id, campaign, action);
        await logDecision(
          run.id,
          rule.org_id,
          rule.id,
          campaign,
          "acted",
          action.type,
          { status: campaign.status, budgets: campaign.adGroupBudgets },
          after,
          "ok",
        );
        actionsTaken += 1;
        await notifyOrg(rule.org_id, {
          type: "automacao_disparada",
          title: `Automação "${rule.name}" agiu`,
          body: `Ação "${action.type}" aplicada em ${campaign.name}.`,
          link: "/automacoes/logs",
        });
      } catch (err) {
        hadError = true;
        await logDecision(
          run.id,
          rule.org_id,
          rule.id,
          campaign,
          "acted",
          action.type,
          { status: campaign.status },
          null,
          "error",
          err instanceof Error ? err.message : "Erro desconhecido",
        );
      }
    }
  } finally {
    await db
      .from("automation_runs")
      .update({ finished_at: new Date().toISOString(), status: hadError ? "failed" : "completed", actions_taken: actionsTaken })
      .eq("id", run.id);
    await db.from("automation_rules").update({ last_run_at: new Date().toISOString() }).eq("id", rule.id);
  }
}

async function isOnCooldown(ruleId: string, campaignId: string, cooldownMinutes: number): Promise<boolean> {
  if (cooldownMinutes <= 0) return false;
  const db = createServiceClient();
  const { data } = await db
    .from("automation_run_logs")
    .select("created_at")
    .eq("rule_id", ruleId)
    .eq("entity_id", campaignId)
    .eq("decision", "acted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return false;
  const elapsedMinutes = (Date.now() - new Date(data.created_at).getTime()) / 60000;
  return elapsedMinutes < cooldownMinutes;
}

async function budgetChangedTodayPercent(ruleId: string, campaignId: string): Promise<number> {
  const db = createServiceClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data } = await db
    .from("automation_run_logs")
    .select("value_after")
    .eq("rule_id", ruleId)
    .eq("entity_id", campaignId)
    .eq("action_type", "budget_change")
    .eq("decision", "acted")
    .gte("created_at", since.toISOString());

  let total = 0;
  for (const row of data ?? []) {
    const percent = (row.value_after as { percentApplied?: number } | null)?.percentApplied;
    if (typeof percent === "number") total += percent;
  }
  return total;
}

async function executeAction(
  orgId: string,
  campaign: CampaignForRule,
  action: RuleAction,
): Promise<Record<string, unknown>> {
  const db = createServiceClient();
  const accessToken = await getAccessToken(orgId);
  const provider = getTikTokProvider();

  if (action.type === "pause" || action.type === "activate") {
    const status = action.type === "pause" ? "paused" : "active";
    await provider.updateCampaignStatus(accessToken, campaign.advertiserId, [campaign.tiktokCampaignId], status);
    await db.from("campaigns").update({ status, updated_at: new Date().toISOString() }).eq("id", campaign.id);
    return { status };
  }

  if (action.type === "budget_change") {
    const percent = action.budgetChangePercent ?? 0;
    for (let i = 0; i < campaign.adGroupIds.length; i++) {
      const newBudget = Number((campaign.adGroupBudgets[i] * (1 + percent / 100)).toFixed(2));
      await provider.updateAdGroupBudget(accessToken, campaign.advertiserId, campaign.adGroupTiktokIds[i], newBudget);
      await db
        .from("ad_groups")
        .update({ budget_amount: newBudget, updated_at: new Date().toISOString() })
        .eq("id", campaign.adGroupIds[i]);
    }
    return { percentApplied: percent };
  }

  if (action.type === "notify") {
    return { notified: true };
  }

  return {};
}

async function logDecision(
  runId: string,
  orgId: string,
  ruleId: string,
  campaign: CampaignForRule,
  decision: "would_act" | "acted" | "skipped_condition" | "skipped_cooldown" | "skipped_guardrail",
  actionType: string | null,
  valueBefore: Record<string, unknown> | null,
  valueAfter: Record<string, unknown> | null,
  result: "ok" | "error" | "dry_run",
  errorMessage?: string,
) {
  const db = createServiceClient();
  await db.from("automation_run_logs").insert({
    run_id: runId,
    org_id: orgId,
    rule_id: ruleId,
    entity_type: "campaign",
    entity_id: campaign.id,
    entity_name: campaign.name,
    decision,
    action_type: actionType,
    value_before: valueBefore,
    value_after: valueAfter,
    result,
    error_message: errorMessage ?? null,
  });
}
