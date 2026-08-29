"use client";

import { useState } from "react";
import { Plus, Trash2, Layers, Rocket, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Step1Accounts, type AccountOption } from "@/components/campaigns/wizard/step1-accounts";
import { Step2Campaign } from "@/components/campaigns/wizard/step2-campaign";
import { Step3AdSet } from "@/components/campaigns/wizard/step3-adset";
import { Step4Ad } from "@/components/campaigns/wizard/step4-ad";
import {
  estimateDailyCost,
  type BuilderAdGroupNode,
  type WizardData,
} from "@/lib/campaigns/schema";

// Só chamada dentro de handlers de evento (nunca durante o render) — evita
// violar react-hooks/purity com Math.random().
function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyAdGroup(): BuilderAdGroupNode {
  return { id: newId(), data: {}, ads: [{ id: newId(), data: {} }] };
}

// Fallback determinístico usado só na renderização inicial (antes do usuário
// editar qualquer campo) — nunca gera IDs aleatórios durante o render.
const DEFAULT_AD_GROUPS: BuilderAdGroupNode[] = [{ id: "group-1", data: {}, ads: [{ id: "ad-1", data: {} }] }];

type SelectedNode =
  | { type: "accounts" }
  | { type: "campaign" }
  | { type: "adgroup"; groupId: string }
  | { type: "ad"; groupId: string; adId: string };

export function BuilderView({
  data,
  onChange,
  accounts,
  onReview,
}: {
  data: WizardData;
  onChange: (data: WizardData) => void;
  accounts: AccountOption[];
  onReview: () => void;
}) {
  const adGroups: BuilderAdGroupNode[] =
    data.adGroups && data.adGroups.length > 0 ? data.adGroups : DEFAULT_AD_GROUPS;
  const [selected, setSelected] = useState<SelectedNode>({ type: "accounts" });

  const selectedAccounts = accounts.filter((a) => (data.step1?.accountIds ?? []).includes(a.id));
  const totalAds = adGroups.reduce((sum, g) => sum + g.ads.length, 0);
  const dailyCost = estimateDailyCost({ ...data, adGroups }, selectedAccounts.length);

  function setAdGroups(next: BuilderAdGroupNode[]) {
    onChange({ ...data, adGroups: next });
  }

  function addAdGroup() {
    const group = emptyAdGroup();
    setAdGroups([...adGroups, group]);
    setSelected({ type: "adgroup", groupId: group.id });
  }

  function removeAdGroup(groupId: string) {
    if (adGroups.length <= 1) return;
    const next = adGroups.filter((g) => g.id !== groupId);
    setAdGroups(next);
    if (selected.type === "adgroup" && selected.groupId === groupId) setSelected({ type: "accounts" });
    if (selected.type === "ad" && selected.groupId === groupId) setSelected({ type: "accounts" });
  }

  function updateAdGroupData(groupId: string, value: BuilderAdGroupNode["data"]) {
    setAdGroups(adGroups.map((g) => (g.id === groupId ? { ...g, data: value } : g)));
  }

  function addAd(groupId: string) {
    const adId = newId();
    setAdGroups(adGroups.map((g) => (g.id === groupId ? { ...g, ads: [...g.ads, { id: adId, data: {} }] } : g)));
    setSelected({ type: "ad", groupId, adId });
  }

  function removeAd(groupId: string, adId: string) {
    const group = adGroups.find((g) => g.id === groupId);
    if (!group || group.ads.length <= 1) return;
    setAdGroups(
      adGroups.map((g) => (g.id === groupId ? { ...g, ads: g.ads.filter((a) => a.id !== adId) } : g)),
    );
    if (selected.type === "ad" && selected.groupId === groupId && selected.adId === adId) {
      setSelected({ type: "adgroup", groupId });
    }
  }

  function updateAdData(groupId: string, adId: string, value: BuilderAdGroupNode["ads"][number]["data"]) {
    setAdGroups(
      adGroups.map((g) =>
        g.id === groupId ? { ...g, ads: g.ads.map((a) => (a.id === adId ? { ...a, data: value } : a)) } : g,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Nova campanha</h1>
        <p className="mt-1 text-sm text-text-muted">Estilo Builder — árvore, edição e custo ao vivo em uma tela.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_300px]">
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-3">
          <button
            type="button"
            onClick={() => setSelected({ type: "accounts" })}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${selected.type === "accounts" ? "bg-accent-soft text-primary" : "text-foreground hover:bg-secondary"}`}
          >
            <UsersIcon className="h-4 w-4 shrink-0" /> Contas ({selectedAccounts.length})
          </button>
          <button
            type="button"
            onClick={() => setSelected({ type: "campaign" })}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${selected.type === "campaign" ? "bg-accent-soft text-primary" : "text-foreground hover:bg-secondary"}`}
          >
            <Rocket className="h-4 w-4 shrink-0" /> Campanha
          </button>

          <div className="mt-2 flex items-center justify-between px-2.5">
            <p className="micro-label">Conjuntos</p>
            <button
              type="button"
              onClick={addAdGroup}
              data-testid="add-adgroup-btn"
              className="text-primary hover:text-primary/80"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            {adGroups.map((group, gi) => (
              <div key={group.id} data-testid="adgroup-block">
                <div
                  className={`group flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm ${selected.type === "adgroup" && selected.groupId === group.id ? "bg-accent-soft text-primary" : "text-foreground hover:bg-secondary"}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelected({ type: "adgroup", groupId: group.id })}
                    data-testid="select-adgroup"
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <Layers className="h-4 w-4 shrink-0" /> Conjunto {gi + 1}
                  </button>
                  {adGroups.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeAdGroup(group.id)}
                      className="opacity-0 group-hover:opacity-100 text-text-faint hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col gap-0.5 pl-6">
                  {group.ads.map((ad, ai) => (
                    <div
                      key={ad.id}
                      className={`group flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm ${selected.type === "ad" && selected.adId === ad.id ? "bg-accent-soft text-primary" : "text-text-muted hover:bg-secondary"}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelected({ type: "ad", groupId: group.id, adId: ad.id })}
                        data-testid="select-ad"
                        className="flex-1 text-left"
                      >
                        Anúncio {ai + 1}
                      </button>
                      {group.ads.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeAd(group.id, ad.id)}
                          className="opacity-0 group-hover:opacity-100 text-text-faint hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addAd(group.id)}
                    data-testid="add-ad-btn"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-left text-xs font-medium text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Anúncio
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          {selected.type === "accounts" ? (
            <Step1Accounts
              accounts={accounts}
              selectedIds={data.step1?.accountIds ?? []}
              onChange={(ids) => onChange({ ...data, step1: { ...data.step1, accountIds: ids } })}
            />
          ) : null}
          {selected.type === "campaign" ? (
            <Step2Campaign
              value={data.step2 ?? {}}
              onChange={(v) => onChange({ ...data, step2: v })}
              errors={{}}
            />
          ) : null}
          {selected.type === "adgroup"
            ? (() => {
                const group = adGroups.find((g) => g.id === selected.groupId);
                if (!group) return null;
                return (
                  <Step3AdSet
                    value={group.data}
                    onChange={(v) => updateAdGroupData(group.id, v)}
                    errors={{}}
                  />
                );
              })()
            : null}
          {selected.type === "ad"
            ? (() => {
                const group = adGroups.find((g) => g.id === selected.groupId);
                const ad = group?.ads.find((a) => a.id === selected.adId);
                if (!group || !ad) return null;
                return (
                  <Step4Ad
                    value={ad.data}
                    onChange={(v) => updateAdData(group.id, ad.id, v)}
                    errors={{}}
                  />
                );
              })()
            : null}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
          <div>
            <p className="micro-label mb-2">Prévia ao vivo</p>
            <div className="flex flex-col gap-1 text-sm text-text-muted">
              <p>
                <span className="font-medium text-foreground">{selectedAccounts.length}</span> conta
                {selectedAccounts.length === 1 ? "" : "s"} selecionada{selectedAccounts.length === 1 ? "" : "s"}
              </p>
              <p>
                <span className="font-medium text-foreground">{adGroups.length}</span> conjunto
                {adGroups.length === 1 ? "" : "s"} por campanha
              </p>
              <p>
                <span className="font-medium text-foreground">{totalAds}</span> anúncio{totalAds === 1 ? "" : "s"} por
                campanha
              </p>
              <p>
                <span className="font-medium text-foreground">{adGroups.length * selectedAccounts.length}</span>{" "}
                conjunto(s) no total
              </p>
              <p>
                <span className="font-medium text-foreground">{totalAds * selectedAccounts.length}</span> anúncio(s)
                no total
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <p className="micro-label mb-1">Custo diário estimado</p>
            <p className="text-xl font-semibold tabular-nums text-foreground" data-testid="live-daily-cost">
              {dailyCost === null ? "—" : `R$ ${dailyCost.toFixed(2)}`}
            </p>
          </div>

          <Button type="button" onClick={onReview} className="mt-auto">
            Revisar e publicar
          </Button>
        </div>
      </div>
    </div>
  );
}
