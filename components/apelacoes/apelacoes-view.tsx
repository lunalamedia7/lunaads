"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { RefreshCw, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ShieldAlert } from "lucide-react";
import {
  toggleAutoAppeal,
  syncRejectionsNow,
  appealSelectedAds,
} from "@/lib/actions/appeals";

export type AppealRow = {
  id: string;
  status: string;
  strategy: "api" | "assisted";
  advertiserId: string;
  bcId: string | null;
  tiktokAdgroupId: string;
  adName: string;
  rejectReason: string | null;
  tiktokResponse: string | null;
  sentText: string | null;
  createdAt: string;
};

export type AppealSettings = {
  autoAppealEnabled: boolean;
  minIntervalSeconds: number;
  dailyCapPerAccount: number;
  pausedReason: string | null;
  lastSentAt: string | null;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Aguardando apelo", className: "bg-secondary text-text-muted" },
  queued: { label: "Em apelação", className: "bg-warning/10 text-warning" },
  sent: { label: "Enviado", className: "bg-accent-soft text-primary" },
  approved: { label: "Aprovado", className: "bg-success/10 text-success" },
  failed: { label: "Falhou", className: "bg-danger/10 text-danger" },
};

export function ApelacoesView({
  appeals,
  settings,
}: {
  appeals: AppealRow[];
  settings: AppealSettings;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error: string | null; success: string | null }>({
    error: null,
    success: null,
  });
  const [autoEnabled, setAutoEnabled] = useState(settings.autoAppealEnabled);
  const [now, setNow] = useState(() => Date.now());

  const total = appeals.length;
  const pending = appeals.filter((a) => a.status === "pending").length;
  const inProgress = appeals.filter((a) => a.status === "queued" || a.status === "sent").length;
  const approved = appeals.filter((a) => a.status === "approved").length;
  const failed = appeals.filter((a) => a.status === "failed").length;
  const appealedCount = total - pending - failed;

  useEffect(() => {
    if (!autoEnabled || !settings.lastSentAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [autoEnabled, settings.lastSentAt]);

  const secondsLeft =
    autoEnabled && settings.lastSentAt
      ? Math.max(
          0,
          Math.round(
            (new Date(settings.lastSentAt).getTime() + settings.minIntervalSeconds * 1000 - now) / 1000,
          ),
        )
      : null;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSync() {
    setMessage({ error: null, success: null });
    startTransition(async () => {
      const result = await syncRejectionsNow();
      setMessage(result);
    });
  }

  function handleAppealSelected() {
    setMessage({ error: null, success: null });
    startTransition(async () => {
      const result = await appealSelectedAds(Array.from(selected));
      setMessage(result);
      if (!result.error) setSelected(new Set());
    });
  }

  function handleToggleAuto(checked: boolean) {
    setAutoEnabled(checked);
    startTransition(async () => {
      await toggleAutoAppeal(checked);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight text-foreground">Apelações</h1>
          <p className="mt-1 text-sm text-text-muted">Gerencie criativos reprovados rapidamente.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <Switch checked={autoEnabled} onCheckedChange={handleToggleAuto} />
            Auto Apelação
          </label>
          <Button variant="outline" onClick={handleSync} disabled={isPending}>
            <RefreshCw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Sincronizar agora
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-text-muted">
        {autoEnabled ? (
          settings.pausedReason ? (
            <span className="text-warning">{settings.pausedReason}</span>
          ) : (
            <span>
              Auto Apelação ativa
              {secondsLeft !== null ? ` · Próxima apelação em: ${secondsLeft}s` : ""} · Apelados:{" "}
              {appealedCount} / {pending} pendentes
              <span className="ml-1 text-xs text-text-faint">
                (teto {settings.dailyCapPerAccount}/dia por conta · só cobre anúncios Smart+, via API)
              </span>
            </span>
          )
        ) : (
          <span>Auto Apelação desativada — apele manualmente selecionando os anúncios abaixo.</span>
        )}
      </div>

      {message.error ? <p className="text-sm text-danger">{message.error}</p> : null}
      {message.success ? <p className="text-sm text-success">{message.success}</p> : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Total de apelos" value={total} />
        <Stat label="Aguardando apelo" value={pending} />
        <Stat label="Em apelação" value={inProgress} />
        <Stat label="Aprovados (recentes)" value={approved} tone="success" />
        <Stat label="Falhados" value={failed} tone="danger" />
      </div>

      {selected.size > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
          <span className="text-sm text-text-muted">{selected.size} selecionada(s)</span>
          <Button size="sm" onClick={handleAppealSelected} disabled={isPending}>
            <Send className="h-3.5 w-3.5" /> Apelar selecionadas
          </Button>
        </div>
      ) : null}

      {appeals.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="Nenhum criativo reprovado"
          description="Clique em 'Sincronizar agora' para verificar se há anúncios reprovados."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="micro-label px-3 py-3" />
                <th className="micro-label px-3 py-3">Data</th>
                <th className="micro-label px-3 py-3">Status</th>
                <th className="micro-label px-3 py-3">Estratégia</th>
                <th className="micro-label px-3 py-3">Conta / BC</th>
                <th className="micro-label px-3 py-3">Anúncio</th>
                <th className="micro-label px-3 py-3">Resposta do TikTok</th>
                <th className="micro-label px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {appeals.map((appeal) => {
                const status = STATUS_LABELS[appeal.status] ?? STATUS_LABELS.pending;
                const isExpanded = expanded.has(appeal.id);
                return (
                  <Fragment key={appeal.id}>
                    <tr className="border-b border-border last:border-0">
                      <td className="px-3 py-2.5">
                        {appeal.status === "pending" ? (
                          <Checkbox
                            checked={selected.has(appeal.id)}
                            onCheckedChange={() => toggleSelect(appeal.id)}
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-text-faint">
                        {new Date(appeal.createdAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className={`border-none ${status.className}`}>{status.label}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-text-muted">
                        {appeal.strategy === "api" ? "API (Smart+)" : "Assistida"}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-mono text-xs text-text-faint">{appeal.advertiserId}</p>
                        <p className="text-xs text-text-faint">{appeal.bcId ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2.5 text-foreground">{appeal.adName}</td>
                      <td className="px-3 py-2.5 text-text-muted">{appeal.tiktokResponse ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right">
                        {appeal.sentText ? (
                          <button type="button" onClick={() => toggleExpand(appeal.id)}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {isExpanded && appeal.sentText ? (
                      <tr className="border-b border-border bg-secondary/20">
                        <td colSpan={8} className="px-3 py-2 text-xs text-text-muted">
                          <strong>Texto enviado:</strong> {appeal.sentText}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="micro-label">{label}</p>
        <p
          className={`tabular-nums text-2xl font-semibold ${
            tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
