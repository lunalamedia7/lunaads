"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Search, Pause, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { ListChecks } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import {
  bulkUpdateAdGroupStatus,
  bulkUpdateAdGroupBudget,
} from "@/lib/actions/gerenciador";

export type AdGroupRow = {
  id: string;
  name: string;
  status: string;
  budgetMode: string | null;
  budgetAmount: number | null;
};

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  budgetAmount: number | null;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  attributedRevenue: number;
  currency: string;
  accountName: string;
  bcName: string;
  adGroups: AdGroupRow[];
};

const ALL = "__all__";

function ctr(clicks: number | null, impressions: number | null) {
  if (!clicks || !impressions) return null;
  return (clicks / impressions) * 100;
}
function cpc(spend: number | null, clicks: number | null) {
  if (!spend || !clicks) return null;
  return spend / clicks;
}
function cpm(spend: number | null, impressions: number | null) {
  if (!spend || !impressions) return null;
  return (spend / impressions) * 1000;
}
function cpa(spend: number | null, conversions: number | null) {
  if (!spend || !conversions) return null;
  return spend / conversions;
}
function roi(revenue: number, spend: number | null) {
  if (!spend) return null;
  return revenue / spend;
}

export function GerenciadorView({
  campaigns,
  bcOptions,
}: {
  campaigns: CampaignRow[];
  bcOptions: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [bcFilter, setBcFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedAdGroups, setSelectedAdGroups] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<null | { type: "pause" | "activate" | "budget"; percent?: number }>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (bcFilter !== ALL && c.bcName !== bcFilter) return false;
      if (statusFilter !== ALL && c.status !== statusFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [campaigns, query, bcFilter, statusFilter]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAdGroup(id: string) {
    setSelectedAdGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCampaignAdGroups(campaign: CampaignRow) {
    const ids = campaign.adGroups.map((a) => a.id);
    const allSelected = ids.every((id) => selectedAdGroups.has(id));
    setSelectedAdGroups((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function runConfirmedAction() {
    if (!confirmAction) return;
    const ids = Array.from(selectedAdGroups);
    setActionError(null);
    startTransition(async () => {
      let result;
      if (confirmAction.type === "budget") {
        result = await bulkUpdateAdGroupBudget(ids, "percent", confirmAction.percent ?? 0);
      } else {
        result = await bulkUpdateAdGroupStatus(ids, confirmAction.type === "activate" ? "active" : "paused");
      }
      if (result.error) setActionError(result.error);
      else {
        setActionSuccess(result.success);
        setSelectedAdGroups(new Set());
      }
      setConfirmAction(null);
    });
  }

  const selectedCount = selectedAdGroups.size;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <Input
            placeholder="Buscar por nome..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={bcFilter} onValueChange={(v) => setBcFilter(v ?? ALL)}>
          <SelectTrigger className="w-44">
            <span>{bcFilter === ALL ? "Todos os BCs" : bcFilter}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os BCs</SelectItem>
            {bcOptions.map((bc) => (
              <SelectItem key={bc.id} value={bc.name}>{bc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
          <SelectTrigger className="w-36">
            <span>{statusFilter === ALL ? "Todos status" : statusFilter === "active" ? "Ativa" : "Pausada"}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos status</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="paused">Pausada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedCount > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
          <span className="text-sm text-text-muted">{selectedCount} conjunto(s) selecionado(s)</span>
          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: "activate" })}>
            <Play className="h-3.5 w-3.5" /> Ativar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: "pause" })}>
            <Pause className="h-3.5 w-3.5" /> Pausar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: "budget", percent: 20 })}>
            Orçamento +20%
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: "budget", percent: -20 })}>
            Orçamento -20%
          </Button>
        </div>
      ) : null}
      {actionError ? <p className="text-sm text-danger">{actionError}</p> : null}
      {actionSuccess ? <p className="text-sm text-success">{actionSuccess}</p> : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={campaigns.length === 0 ? "Nenhuma campanha publicada ainda" : "Nada encontrado"}
          description={
            campaigns.length === 0
              ? "Publique uma campanha em 'Nova campanha' para gerenciá-la aqui."
              : "Tente ajustar a busca ou os filtros."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="micro-label px-3 py-3" />
                <th className="micro-label px-3 py-3">Campanha / Conjunto</th>
                <th className="micro-label px-3 py-3">Status</th>
                <th className="micro-label px-3 py-3 text-right">Orçamento</th>
                <th className="micro-label px-3 py-3 text-right">Gasto</th>
                <th className="micro-label px-3 py-3 text-right">CTR</th>
                <th className="micro-label px-3 py-3 text-right">CPC</th>
                <th className="micro-label px-3 py-3 text-right">CPM</th>
                <th className="micro-label px-3 py-3 text-right">Conversões</th>
                <th className="micro-label px-3 py-3 text-right">CPA</th>
                <th className="micro-label px-3 py-3 text-right">Vendas atribuídas</th>
                <th className="micro-label px-3 py-3 text-right">ROI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((campaign) => {
                const isOpen = expanded.has(campaign.id);
                const campaignRoi = roi(campaign.attributedRevenue, campaign.spend);
                return (
                  <Fragment key={campaign.id}>
                    <tr className="border-b border-border bg-secondary/30 hover:bg-secondary/50">
                      <td className="px-3 py-2.5">
                        <button type="button" onClick={() => toggleExpand(campaign.id)}>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-foreground">{campaign.name}</p>
                        <p className="text-xs text-text-faint">{campaign.accountName} · {campaign.bcName}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className={campaign.status === "active" ? "border-none bg-success/10 text-success" : "border-none bg-secondary text-text-muted"}>
                          {campaign.status === "active" ? "Ativa" : "Pausada"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {campaign.budgetAmount ? formatCurrency(campaign.budgetAmount, campaign.currency) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {campaign.spend !== null ? formatCurrency(campaign.spend, campaign.currency) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {ctr(campaign.clicks, campaign.impressions)?.toFixed(2) ?? "—"}{ctr(campaign.clicks, campaign.impressions) !== null ? "%" : ""}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {cpc(campaign.spend, campaign.clicks) !== null ? formatCurrency(cpc(campaign.spend, campaign.clicks)!, campaign.currency) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {cpm(campaign.spend, campaign.impressions) !== null ? formatCurrency(cpm(campaign.spend, campaign.impressions)!, campaign.currency) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{campaign.conversions ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {cpa(campaign.spend, campaign.conversions) !== null ? formatCurrency(cpa(campaign.spend, campaign.conversions)!, campaign.currency) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-success">
                        {formatCurrency(campaign.attributedRevenue, "BRL")}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {campaignRoi === null ? "—" : `${campaignRoi.toFixed(2)}x`}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr key={`${campaign.id}-header`} className="border-b border-border">
                        <td colSpan={12} className="bg-background px-3 py-1">
                          <button
                            type="button"
                            onClick={() => toggleCampaignAdGroups(campaign)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Selecionar todos os conjuntos
                          </button>
                        </td>
                      </tr>
                    ) : null}
                    {isOpen
                      ? campaign.adGroups.map((adGroup) => (
                          <tr key={adGroup.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 pl-8">
                              <Checkbox
                                checked={selectedAdGroups.has(adGroup.id)}
                                onCheckedChange={() => toggleAdGroup(adGroup.id)}
                              />
                            </td>
                            <td className="px-3 py-2 pl-2 text-text-muted">└ {adGroup.name}</td>
                            <td className="px-3 py-2">
                              <Badge className={adGroup.status === "active" ? "border-none bg-success/10 text-success" : "border-none bg-secondary text-text-muted"}>
                                {adGroup.status === "active" ? "Ativo" : "Pausado"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {adGroup.budgetAmount ? formatCurrency(adGroup.budgetAmount, campaign.currency) : "—"}
                            </td>
                            <td colSpan={7} />
                          </tr>
                        ))
                      : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar ação em massa</DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "pause" && `Você vai pausar ${selectedCount} conjunto(s).`}
              {confirmAction?.type === "activate" && `Você vai ativar ${selectedCount} conjunto(s).`}
              {confirmAction?.type === "budget" &&
                `Você vai alterar o orçamento de ${selectedCount} conjunto(s) em ${confirmAction.percent}%.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button onClick={runConfirmedAction} disabled={isPending}>
              {isPending ? "Aplicando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
