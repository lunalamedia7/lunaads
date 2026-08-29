"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { ruleFormSchema, type RuleFormData } from "@/lib/automations/schema";

export type AutomationActionState = { error: string | null; success: string | null };

async function recordAudit(orgId: string, action: string, payload: Record<string, unknown>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor_id: user?.id ?? null,
    action,
    entity: "automation_rule",
    payload,
  });
}

export async function createRule(
  _prevState: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  const org = await requireRole("operator");

  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  const scopeIdsRaw = formData.getAll("scopeIds");
  raw.scopeIds = scopeIdsRaw;

  const parsed = ruleFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", success: null };
  }

  const data: RuleFormData = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("automation_rules").insert({
    org_id: org.id,
    name: data.name,
    trigger_type: data.triggerType,
    trigger_config: { intervalMinutes: data.intervalMinutes },
    condition: {
      metric: data.metric,
      operator: data.operator,
      value: data.value,
      minConversions: data.minConversions,
    },
    action: {
      type: data.actionType,
      budgetChangePercent: data.budgetChangePercent,
    },
    scope: { type: data.scopeType, ids: data.scopeIds },
    is_dry_run: true,
    is_active: true,
    max_actions_per_run: data.maxActionsPerRun,
    cooldown_minutes: data.cooldownMinutes,
    max_budget_change_percent_per_day: data.maxBudgetChangePercentPerDay,
    created_by: user?.id ?? null,
  });

  if (error) return { error: "Não foi possível criar a regra.", success: null };

  await recordAudit(org.id, "automation_rule.created", { name: data.name });
  revalidatePath("/automacoes");
  return { error: null, success: "Regra criada em modo simulação (dry run) por 24h." };
}

export async function promoteRuleToLive(ruleId: string): Promise<AutomationActionState> {
  const org = await requireRole("operator");
  const supabase = await createClient();
  const { error } = await supabase
    .from("automation_rules")
    .update({ is_dry_run: false, updated_at: new Date().toISOString() })
    .eq("id", ruleId)
    .eq("org_id", org.id);

  if (error) return { error: "Não foi possível ativar.", success: null };
  await recordAudit(org.id, "automation_rule.activated_live", { ruleId });
  revalidatePath("/automacoes");
  return { error: null, success: "Regra ativada — vai agir de verdade a partir de agora." };
}

export async function toggleRuleActive(ruleId: string, isActive: boolean): Promise<AutomationActionState> {
  const org = await requireRole("operator");
  const supabase = await createClient();
  const { error } = await supabase
    .from("automation_rules")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", ruleId)
    .eq("org_id", org.id);

  if (error) return { error: "Não foi possível atualizar.", success: null };
  await recordAudit(org.id, isActive ? "automation_rule.enabled" : "automation_rule.disabled", { ruleId });
  revalidatePath("/automacoes");
  return { error: null, success: null };
}

export async function deleteRule(ruleId: string): Promise<AutomationActionState> {
  const org = await requireRole("operator");
  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").delete().eq("id", ruleId).eq("org_id", org.id);

  if (error) return { error: "Não foi possível remover.", success: null };
  revalidatePath("/automacoes");
  return { error: null, success: "Regra removida." };
}
