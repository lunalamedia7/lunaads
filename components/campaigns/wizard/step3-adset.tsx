"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Step3Data } from "@/lib/campaigns/schema";

const GENDER_OPTIONS = [
  { value: "ALL", label: "Todos" },
  { value: "MALE", label: "Masculino" },
  { value: "FEMALE", label: "Feminino" },
] as const;

export function Step3AdSet({
  value,
  onChange,
  errors,
}: {
  value: Partial<Step3Data>;
  onChange: (value: Partial<Step3Data>) => void;
  errors: Record<string, string>;
}) {
  const genders = value.genders ?? [];

  function toggleGender(g: "ALL" | "MALE" | "FEMALE") {
    onChange({
      ...value,
      genders: genders.includes(g) ? genders.filter((x) => x !== g) : [...genders, g],
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Conjunto de anúncios</h2>
        <p className="text-sm text-text-muted">Segmentação, orçamento e agendamento.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="optimizationGoal">Objetivo de otimização</Label>
          <Input
            id="optimizationGoal"
            placeholder="Ex: CONVERT, CLICK, REACH"
            value={value.optimizationGoal ?? ""}
            onChange={(e) => onChange({ ...value, optimizationGoal: e.target.value })}
          />
          {errors.optimizationGoal ? <p className="text-sm text-danger">{errors.optimizationGoal}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="conversionEvent">Evento de conversão</Label>
          <Input
            id="conversionEvent"
            placeholder="Ex: CompletePayment"
            value={value.conversionEvent ?? ""}
            onChange={(e) => onChange({ ...value, conversionEvent: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pixelId">Pixel (opcional por enquanto)</Label>
          <Input
            id="pixelId"
            placeholder="ID do pixel"
            value={value.pixelId ?? ""}
            onChange={(e) => onChange({ ...value, pixelId: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Posicionamento</Label>
          <RadioGroup
            value={value.placementMode ?? "AUTOMATIC"}
            onValueChange={(v) => onChange({ ...value, placementMode: v as "AUTOMATIC" | "MANUAL" })}
            className="flex gap-4"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="AUTOMATIC" /> Automático
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="MANUAL" /> Manual
            </label>
          </RadioGroup>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="countries">Países (códigos separados por vírgula)</Label>
          <Input
            id="countries"
            placeholder="BR, PT"
            value={(value.countries ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...value,
                countries: e.target.value
                  .split(",")
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean),
              })
            }
          />
          {errors.countries ? <p className="text-sm text-danger">{errors.countries}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="languages">Idiomas (opcional)</Label>
          <Input
            id="languages"
            placeholder="pt, en"
            value={(value.languages ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...value,
                languages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ageMin">Idade mín.</Label>
          <Input
            id="ageMin"
            type="number"
            min={13}
            max={65}
            className="w-24"
            value={value.ageMin ?? ""}
            onChange={(e) => onChange({ ...value, ageMin: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ageMax">Idade máx.</Label>
          <Input
            id="ageMax"
            type="number"
            min={13}
            max={65}
            className="w-24"
            value={value.ageMax ?? ""}
            onChange={(e) => onChange({ ...value, ageMax: Number(e.target.value) })}
          />
          {errors.ageMax ? <p className="text-sm text-danger">{errors.ageMax}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label>Gênero</Label>
          <div className="flex gap-3">
            {GENDER_OPTIONS.map((g) => (
              <label key={g.value} className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={genders.includes(g.value)} onCheckedChange={() => toggleGender(g.value)} />
                {g.label}
              </label>
            ))}
          </div>
          {errors.genders ? <p className="text-sm text-danger">{errors.genders}</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label>Orçamento do conjunto</Label>
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
          <Label htmlFor="adsetBudget">Valor (R$)</Label>
          <Input
            id="adsetBudget"
            type="number"
            min={0}
            step="0.01"
            className="w-32"
            value={value.budgetAmount ?? ""}
            onChange={(e) => onChange({ ...value, budgetAmount: Number(e.target.value) })}
          />
          {errors.budgetAmount ? <p className="text-sm text-danger">{errors.budgetAmount}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Tipo de lance</Label>
          <RadioGroup
            value={value.bidType ?? "LOWEST_COST"}
            onValueChange={(v) =>
              onChange({ ...value, bidType: v as "LOWEST_COST" | "COST_CAP" | "BID_CAP" })
            }
            className="flex flex-wrap gap-4"
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="LOWEST_COST" /> Menor custo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="COST_CAP" /> Teto de custo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="BID_CAP" /> Teto de lance
            </label>
          </RadioGroup>
        </div>
        {value.bidType && value.bidType !== "LOWEST_COST" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="bidAmount">Valor do lance (R$)</Label>
            <Input
              id="bidAmount"
              type="number"
              min={0}
              step="0.01"
              className="w-32"
              value={value.bidAmount ?? ""}
              onChange={(e) => onChange({ ...value, bidAmount: Number(e.target.value) })}
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="startDate">Início</Label>
          <Input
            id="startDate"
            type="date"
            value={value.startDate ?? ""}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
          />
          {errors.startDate ? <p className="text-sm text-danger">{errors.startDate}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="endDate">Fim (opcional)</Label>
          <Input
            id="endDate"
            type="date"
            value={value.endDate ?? ""}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Modo de entrega</Label>
        <RadioGroup
          value={value.deliveryType ?? "STANDARD"}
          onValueChange={(v) => onChange({ ...value, deliveryType: v as "STANDARD" | "ACCELERATED" })}
          className="flex gap-4"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="STANDARD" /> Padrão
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="ACCELERATED" /> Acelerado
          </label>
        </RadioGroup>
      </div>
    </div>
  );
}
