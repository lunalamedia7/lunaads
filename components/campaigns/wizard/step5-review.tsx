"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import {
  CAMPAIGN_OBJECTIVES,
  previewCampaignName,
  normalizeAdGroups,
  estimateDailyCost,
  type WizardData,
} from "@/lib/campaigns/schema";
import { startPublishBatch } from "@/lib/actions/publish";
import { createTemplate } from "@/lib/actions/campaign-templates";
import type { AccountOption } from "@/components/campaigns/wizard/step1-accounts";

export function Step5Review({
  data,
  accounts,
}: {
  data: WizardData;
  accounts: AccountOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"safe" | "fast">("safe");
  const [isPublishing, startPublishing] = useTransition();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  const selectedAccounts = accounts.filter((a) => (data.step1?.accountIds ?? []).includes(a.id));
  const objectiveLabel = CAMPAIGN_OBJECTIVES.find((o) => o.value === data.step2?.objective)?.label;
  const totalDailyCost = estimateDailyCost(data, selectedAccounts.length);

  let adGroups: ReturnType<typeof normalizeAdGroups> = [];
  let treeError: string | null = null;
  try {
    adGroups = normalizeAdGroups(data);
  } catch {
    treeError = "Revise os conjuntos e anúncios — algo ficou incompleto ou inválido.";
  }

  const warnings = selectedAccounts
    .filter((a) => a.isLimited || !a.canReadFinance)
    .map((a) => `${a.name}: ${a.isLimited ? "conta limitada" : "sem permissão financeira"}`);

  const blocking: string[] = [];
  if (selectedAccounts.length === 0) blocking.push("Nenhuma conta selecionada.");
  if (treeError) blocking.push(treeError);

  async function handlePublish() {
    setPublishError(null);
    startPublishing(async () => {
      const result = await startPublishBatch(data, mode);
      if (result.error) {
        setPublishError(result.error);
        return;
      }
      router.push(`/historico/${result.batchId}`);
    });
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    const formData = new FormData();
    formData.set("name", templateName);
    formData.set("config", JSON.stringify(data));
    await createTemplate({ error: null, success: null }, formData);
    setSavingTemplate(false);
    setTemplateSaved(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Revisão</h2>
        <p className="text-sm text-text-muted">Confira tudo antes de publicar.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 pt-6 text-sm">
          <p className="text-foreground">
            <strong>{selectedAccounts.length}</strong> campanha{selectedAccounts.length === 1 ? "" : "s"} será
            {selectedAccounts.length === 1 ? "" : "ão"} criada{selectedAccounts.length === 1 ? "" : "s"} — uma por
            conta selecionada.
          </p>
          <p className="text-text-muted">Objetivo: {objectiveLabel ?? "—"}</p>
          <p className="text-text-muted">
            Exemplo de nome: <span className="font-mono">{previewCampaignName(data.step2?.namePattern ?? "", 0)}</span>
          </p>
          <p className="text-text-muted">
            {adGroups.length} conjunto{adGroups.length === 1 ? "" : "s"} de anúncios por campanha,{" "}
            {adGroups.reduce((sum, g) => sum + g.ads.length, 0)} anúncio(s) no total por campanha.
          </p>
          <p className="tabular-nums font-medium text-foreground">
            Custo diário somado: {totalDailyCost === null ? "—" : `R$ ${totalDailyCost.toFixed(2)}`}
          </p>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border p-3">
        <p className="micro-label mb-2">Árvore do que será criado</p>
        <div className="flex flex-col gap-1 text-sm">
          {selectedAccounts.map((account, i) => (
            <div key={account.id} className="flex flex-col pl-2">
              <span className="text-foreground">
                📁 {previewCampaignName(data.step2?.namePattern ?? "", i)} — {account.name}
              </span>
              {adGroups.map((group, gi) => (
                <div key={gi} className="flex flex-col">
                  <span className="pl-4 text-text-muted">
                    └ conjunto {gi + 1}{adGroups.length > 1 ? ` de ${adGroups.length}` : ""}
                  </span>
                  {group.ads.map((_, ai) => (
                    <span key={ai} className="pl-8 text-text-muted">
                      └ anúncio {ai + 1}{group.ads.length > 1 ? ` de ${group.ads.length}` : ""}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {blocking.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {blocking.map((b) => (
            <div key={b} className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {b}
            </div>
          ))}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          {warnings.map((w) => (
            <div key={w} className="flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0" /> {w}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="micro-label">Modo de publicação</p>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as "safe" | "fast")} className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="safe" /> Subir com Segurança (intervalo aleatório entre contas)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="fast" /> Rápido (menor segurança)
          </label>
        </RadioGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Input
          placeholder="Nome do template (opcional)"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="max-w-xs"
        />
        <Button type="button" variant="outline" onClick={handleSaveTemplate} disabled={savingTemplate || !templateName.trim()}>
          <Save className="h-4 w-4" /> {templateSaved ? "Salvo!" : "Salvar como template"}
        </Button>
      </div>

      {publishError ? <p className="text-sm text-danger">{publishError}</p> : null}

      <Button
        type="button"
        size="lg"
        onClick={handlePublish}
        disabled={isPublishing || blocking.length > 0}
        className="self-start"
      >
        {isPublishing ? "Publicando..." : `Publicar em ${selectedAccounts.length} conta${selectedAccounts.length === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}
