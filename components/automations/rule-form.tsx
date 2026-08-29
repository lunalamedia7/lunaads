"use client";

import { useActionState, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  METRIC_OPTIONS,
  OPERATOR_OPTIONS,
  ACTION_TYPES,
  SCOPE_TYPES,
} from "@/lib/automations/schema";
import { createRule } from "@/lib/actions/automations";

const initialState = { error: null, success: null };

export function RuleForm({
  accounts,
  businessCenters,
  onDone,
}: {
  accounts: { id: string; name: string }[];
  businessCenters: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(createRule, initialState);
  const [metric, setMetric] = useState("cpa");
  const [operator, setOperator] = useState("gt");
  const [actionType, setActionType] = useState("pause");
  const [scopeType, setScopeType] = useState("all");
  const [scopeIds, setScopeIds] = useState<string[]>([]);

  const scopeOptions = scopeType === "account" ? accounts : scopeType === "bc" ? businessCenters : [];

  function toggleScopeId(id: string) {
    setScopeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          action={async (formData) => {
            await formAction(formData);
            onDone();
          }}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nome da regra</Label>
            <Input id="name" name="name" placeholder="Ex: Pausar CPA alto" required className="max-w-sm" />
          </div>

          <div>
            <p className="micro-label mb-2">Gatilho</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">A cada</span>
              <Input name="intervalMinutes" type="number" min={15} defaultValue={60} className="w-24" />
              <span className="text-sm text-text-muted">minutos</span>
            </div>
          </div>

          <div>
            <p className="micro-label mb-2">Condição</p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="metric" value={metric} />
              <Select value={metric} onValueChange={(v) => setMetric(v ?? "cpa")}>
                <SelectTrigger className="w-32">
                  <span>{METRIC_OPTIONS.find((m) => m.value === metric)?.label}</span>
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="operator" value={operator} />
              <Select value={operator} onValueChange={(v) => setOperator(v ?? "gt")}>
                <SelectTrigger className="w-40">
                  <span>{OPERATOR_OPTIONS.find((o) => o.value === operator)?.label}</span>
                </SelectTrigger>
                <SelectContent>
                  {OPERATOR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input name="value" type="number" step="0.01" placeholder="Valor" className="w-28" required />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-text-muted">com pelo menos</span>
              <Input name="minConversions" type="number" min={0} defaultValue={0} className="w-24" />
              <span className="text-sm text-text-muted">conversões na janela</span>
            </div>
          </div>

          <div>
            <p className="micro-label mb-2">Ação</p>
            <input type="hidden" name="actionType" value={actionType} />
            <Select value={actionType} onValueChange={(v) => setActionType(v ?? "pause")}>
              <SelectTrigger className="w-56">
                <span>{ACTION_TYPES.find((a) => a.value === actionType)?.label}</span>
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {actionType === "budget_change" ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-text-muted">Alterar orçamento em</span>
                <Input name="budgetChangePercent" type="number" step="1" placeholder="ex: -20" className="w-24" />
                <span className="text-sm text-text-muted">%</span>
              </div>
            ) : null}
          </div>

          <div>
            <p className="micro-label mb-2">Escopo</p>
            <input type="hidden" name="scopeType" value={scopeType} />
            <Select
              value={scopeType}
              onValueChange={(v) => {
                setScopeType(v ?? "all");
                setScopeIds([]);
              }}
            >
              <SelectTrigger className="w-56">
                <span>{SCOPE_TYPES.find((s) => s.value === scopeType)?.label}</span>
              </SelectTrigger>
              <SelectContent>
                {SCOPE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {scopeType !== "all" ? (
              <div className="mt-2 flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                {scopeOptions.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={scopeIds.includes(opt.id)} onCheckedChange={() => toggleScopeId(opt.id)} />
                    {opt.name}
                  </label>
                ))}
              </div>
            ) : null}
            {scopeIds.map((id) => (
              <input key={id} type="hidden" name="scopeIds" value={id} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label>Máx. ações por execução</Label>
              <Input name="maxActionsPerRun" type="number" min={1} defaultValue={20} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Cooldown por objeto (min)</Label>
              <Input name="cooldownMinutes" type="number" min={0} defaultValue={60} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Máx. variação de orçamento/dia (%)</Label>
              <Input name="maxBudgetChangePercentPerDay" type="number" min={0} defaultValue={20} />
            </div>
          </div>

          <p className="text-xs text-text-faint">
            Toda regra nova nasce em modo simulação (dry run) por 24h — você confere as decisões antes de ativar de verdade.
          </p>

          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Criando..." : "Criar regra"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
