"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/campaigns/wizard/stepper";
import { ModeSelect } from "@/components/campaigns/wizard/mode-select";
import { Step1Accounts, type AccountOption } from "@/components/campaigns/wizard/step1-accounts";
import { Step2Campaign } from "@/components/campaigns/wizard/step2-campaign";
import { Step3AdSet } from "@/components/campaigns/wizard/step3-adset";
import { Step4Ad } from "@/components/campaigns/wizard/step4-ad";
import { Step5Review } from "@/components/campaigns/wizard/step5-review";
import { BuilderView } from "@/components/campaigns/wizard/builder-view";
import { STEP_SCHEMAS, type WizardData } from "@/lib/campaigns/schema";
import { saveDraft } from "@/lib/actions/campaign-drafts";
import type { ZodError } from "zod";

export type TemplateOption = { id: string; name: string; config: WizardData };

function collectErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

const STEP_KEYS = ["step1", "step2", "step3", "step4"] as const;

export function CampaignWizard({
  accounts,
  templates,
  initialDraft,
}: {
  accounts: AccountOption[];
  templates: TemplateOption[];
  initialDraft: { currentStep: number; data: WizardData } | null;
}) {
  const initialMode: "select" | "fast" | "builder" = initialDraft
    ? initialDraft.data.adGroups && initialDraft.data.adGroups.length > 0
      ? "builder"
      : "fast"
    : "select";
  const [mode, setMode] = useState<"select" | "fast" | "builder">(initialMode);
  const [step, setStep] = useState(initialDraft?.currentStep ?? 1);
  const [maxReached, setMaxReached] = useState(initialDraft?.currentStep ?? 1);
  const [builderReviewing, setBuilderReviewing] = useState(initialMode === "builder" && initialDraft?.currentStep === 5);
  const [data, setData] = useState<WizardData>(initialDraft?.data ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (mode === "select") return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const currentStep = mode === "builder" ? (builderReviewing ? 5 : 1) : step;
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(currentStep, data).then(() => setSaveStatus("saved"));
    }, 700);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- salva sempre que data/step mudam, mode é só o gate
  }, [data, step, builderReviewing]);

  function updateStepData<K extends (typeof STEP_KEYS)[number]>(key: K, value: WizardData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function applyTemplate(templateId: string | null) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setData((prev) => ({
      ...prev,
      step1: { ...prev.step1, templateId },
      step2: template.config.step2 ?? prev.step2,
      step3: template.config.step3 ?? prev.step3,
      step4: template.config.step4 ?? prev.step4,
    }));
  }

  function goNext() {
    const schema = STEP_SCHEMAS[step - 1];
    const key = STEP_KEYS[step - 1];
    if (schema && key) {
      const result = schema.safeParse(data[key] ?? {});
      if (!result.success) {
        setErrors(collectErrors(result.error));
        return;
      }
    }
    setErrors({});
    const next = Math.min(step + 1, 5);
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function goToStep(target: number) {
    if (target > maxReached) return;
    setErrors({});
    setStep(target);
  }

  if (mode === "select") {
    return <ModeSelect onSelectFast={() => setMode("fast")} onSelectBuilder={() => setMode("builder")} />;
  }

  if (mode === "builder") {
    if (builderReviewing) {
      return (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[34px] font-bold tracking-tight text-foreground">Nova campanha</h1>
              <p className="mt-1 text-sm text-text-muted">Estilo Builder — revisão.</p>
            </div>
            {saveStatus !== "idle" ? (
              <span className="text-xs text-text-faint">
                {saveStatus === "saving" ? "Salvando rascunho..." : "Rascunho salvo"}
              </span>
            ) : null}
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Button type="button" variant="outline" onClick={() => setBuilderReviewing(false)} className="mb-5">
              Voltar para a árvore
            </Button>
            <Step5Review data={data} accounts={accounts} />
          </div>
        </div>
      );
    }
    return (
      <BuilderView
        data={data}
        onChange={setData}
        accounts={accounts}
        onReview={() => setBuilderReviewing(true)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight text-foreground">Nova campanha</h1>
          <p className="mt-1 text-sm text-text-muted">Estilo Fast — 5 passos.</p>
        </div>
        {saveStatus !== "idle" ? (
          <span className="text-xs text-text-faint">
            {saveStatus === "saving" ? "Salvando rascunho..." : "Rascunho salvo"}
          </span>
        ) : null}
      </div>

      <Stepper current={step} maxReached={maxReached} onSelect={goToStep} />

      <div className="rounded-2xl border border-border bg-card p-6">
        {step === 1 ? (
          <Step1Accounts
            accounts={accounts}
            selectedIds={data.step1?.accountIds ?? []}
            onChange={(ids) => updateStepData("step1", { ...data.step1, accountIds: ids })}
            error={errors.accountIds}
          />
        ) : null}
        {step === 1 && templates.length > 0 ? (
          <div className="mt-4 border-t border-border pt-4">
            <label className="micro-label mb-2 block">Aplicar template (opcional)</label>
            <select
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
              value={data.step1?.templateId ?? ""}
              onChange={(e) => applyTemplate(e.target.value || null)}
            >
              <option value="">Nenhum</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        {step === 2 ? (
          <Step2Campaign
            value={data.step2 ?? {}}
            onChange={(v) => updateStepData("step2", v)}
            errors={errors}
          />
        ) : null}

        {step === 3 ? (
          <Step3AdSet
            value={data.step3 ?? {}}
            onChange={(v) => updateStepData("step3", v)}
            errors={errors}
          />
        ) : null}

        {step === 4 ? (
          <Step4Ad
            value={data.step4 ?? {}}
            onChange={(v) => updateStepData("step4", v)}
            errors={errors}
          />
        ) : null}

        {step === 5 ? <Step5Review data={data} accounts={accounts} /> : null}
      </div>

      {step < 5 ? (
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={goBack} disabled={step === 1}>
            Voltar
          </Button>
          <Button type="button" onClick={goNext}>
            Próximo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
