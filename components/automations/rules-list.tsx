"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RuleForm } from "@/components/automations/rule-form";
import { METRIC_OPTIONS, OPERATOR_OPTIONS, ACTION_TYPES } from "@/lib/automations/schema";
import { promoteRuleToLive, toggleRuleActive, deleteRule } from "@/lib/actions/automations";

export type RuleRow = {
  id: string;
  name: string;
  isDryRun: boolean;
  isActive: boolean;
  dryRunUntil: string;
  condition: { metric: string; operator: string; value: number; minConversions: number };
  action: { type: string; budgetChangePercent?: number };
};

const initialState = { error: null, success: null };

export function RulesList({
  rules,
  accounts,
  businessCenters,
}: {
  rules: RuleRow[];
  accounts: { id: string; name: string }[];
  businessCenters: { id: string; name: string }[];
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/automacoes/logs" className="text-sm font-medium text-primary hover:underline">
          Ver logs de execução →
        </Link>
        <Button type="button" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Nova regra
        </Button>
      </div>

      {showForm ? (
        <RuleForm accounts={accounts} businessCenters={businessCenters} onDone={() => setShowForm(false)} />
      ) : null}

      {rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhuma automação ainda"
          description="Crie uma regra para pausar, ativar ou ajustar orçamento sozinho, com base em métricas."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleCard({ rule }: { rule: RuleRow }) {
  const [, promoteAction, promotePending] = useActionState(() => promoteRuleToLive(rule.id), initialState);
  const [, toggleAction] = useActionState(() => toggleRuleActive(rule.id, !rule.isActive), initialState);
  const [, deleteAction, deletePending] = useActionState(() => deleteRule(rule.id), initialState);

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === rule.condition.metric)?.label ?? rule.condition.metric;
  const operatorLabel = OPERATOR_OPTIONS.find((o) => o.value === rule.condition.operator)?.label ?? rule.condition.operator;
  const actionLabel = ACTION_TYPES.find((a) => a.value === rule.action.type)?.label ?? rule.action.type;
  const dryRunActive = rule.isDryRun && new Date(rule.dryRunUntil) > new Date();

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{rule.name}</p>
            {dryRunActive ? (
              <Badge className="border-none bg-warning/10 text-warning">Simulação (dry run)</Badge>
            ) : rule.isDryRun ? (
              <Badge className="border-none bg-secondary text-text-muted">Aguardando ativação</Badge>
            ) : (
              <Badge className="border-none bg-success/10 text-success">Ativa de verdade</Badge>
            )}
          </div>
          <p className="text-sm text-text-muted">
            Se {metricLabel} {operatorLabel} {rule.condition.value}
            {rule.condition.minConversions > 0 ? ` (mín. ${rule.condition.minConversions} conversões)` : ""} → {actionLabel}
            {rule.action.type === "budget_change" ? ` (${rule.action.budgetChangePercent}%)` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rule.isDryRun ? (
            <form action={promoteAction}>
              <Button type="submit" size="sm" disabled={promotePending}>
                {promotePending ? "Ativando..." : "Ativar de verdade"}
              </Button>
            </form>
          ) : null}
          <Switch checked={rule.isActive} onCheckedChange={() => toggleAction()} />
          <form action={deleteAction}>
            <Button type="submit" variant="ghost" size="icon-sm" disabled={deletePending} className="text-text-faint hover:text-danger">
              <Trash2 className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
