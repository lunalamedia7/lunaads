"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CAMPAIGN_OBJECTIVES, previewCampaignName, type Step2Data } from "@/lib/campaigns/schema";

export function Step2Campaign({
  value,
  onChange,
  errors,
}: {
  value: Partial<Step2Data>;
  onChange: (value: Partial<Step2Data>) => void;
  errors: Record<string, string>;
}) {
  const namePattern = value.namePattern ?? "CA_{timestamp}_{index}_{random}";
  const objectiveLabel = CAMPAIGN_OBJECTIVES.find((o) => o.value === value.objective)?.label;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Configuração da campanha</h2>
        <p className="text-sm text-text-muted">Vale para todas as contas selecionadas.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Objetivo</Label>
        <Select
          value={value.objective ?? ""}
          onValueChange={(v) => onChange({ ...value, objective: v ?? undefined })}
        >
          <SelectTrigger className="w-full max-w-sm">
            <span>{objectiveLabel ?? "Selecione um objetivo"}</span>
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_OBJECTIVES.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.objective ? <p className="text-sm text-danger">{errors.objective}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="namePattern">Padrão de nome da campanha</Label>
        <Input
          id="namePattern"
          value={namePattern}
          onChange={(e) => onChange({ ...value, namePattern: e.target.value })}
          className="max-w-sm font-mono text-sm"
        />
        <p className="text-xs text-text-faint">
          Variáveis: {"{timestamp}"}, {"{index}"}, {"{random}"}. Exemplo: {previewCampaignName(namePattern, 0)}
        </p>
        {errors.namePattern ? <p className="text-sm text-danger">{errors.namePattern}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label>Tipo de orçamento</Label>
        <RadioGroup
          value={value.budgetType ?? "ABO"}
          onValueChange={(v) => onChange({ ...value, budgetType: v as "CBO" | "ABO" })}
          className="flex gap-4"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="CBO" /> CBO (orçamento da campanha)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="ABO" /> ABO (orçamento do conjunto)
          </label>
        </RadioGroup>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label>Modo</Label>
          <RadioGroup
            value={value.budgetMode ?? "DAILY"}
            onValueChange={(v) => onChange({ ...value, budgetMode: v as "DAILY" | "LIFETIME" })}
            className="flex gap-4"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="DAILY" /> Diário
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="LIFETIME" /> Vitalício
            </label>
          </RadioGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="budgetAmount">Orçamento (R$)</Label>
          <Input
            id="budgetAmount"
            type="number"
            min={0}
            step="0.01"
            value={value.budgetAmount ?? ""}
            onChange={(e) => onChange({ ...value, budgetAmount: Number(e.target.value) })}
            className="w-40"
          />
          {errors.budgetAmount ? <p className="text-sm text-danger">{errors.budgetAmount}</p> : null}
        </div>
      </div>
    </div>
  );
}
