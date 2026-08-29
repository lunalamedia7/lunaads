"use client";

import { useMemo, useState } from "react";
import { Search, ExternalLink, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { CopyButton } from "@/components/copy-button";
import { formatCurrency } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  pending: "Limitada",
  suspended: "Suspensa",
};

export type ContaRow = {
  id: string;
  advertiserId: string;
  name: string;
  currency: string;
  status: string;
  isLimited: boolean;
  canReadFinance: boolean;
  balance: number | null;
  bcId: string;
  bcName: string;
};

const ALL = "__all__";

export function ContasView({ accounts, businessCenters }: {
  accounts: ContaRow[];
  businessCenters: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [bcFilter, setBcFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [currencyFilter, setCurrencyFilter] = useState(ALL);

  const currencies = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.currency))).sort(),
    [accounts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (bcFilter !== ALL && a.bcId !== bcFilter) return false;
      if (statusFilter !== ALL && a.status !== statusFilter) return false;
      if (currencyFilter !== ALL && a.currency !== currencyFilter) return false;
      if (q && !`${a.name} ${a.advertiserId}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [accounts, query, bcFilter, statusFilter, currencyFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <Input
            placeholder="Buscar por nome ou ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={bcFilter} onValueChange={(value) => setBcFilter(value ?? ALL)}>
          <SelectTrigger className="w-44">
            <span>
              {bcFilter === ALL
                ? "Todos os BCs"
                : (businessCenters.find((bc) => bc.id === bcFilter)?.name ?? "Todos os BCs")}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os BCs</SelectItem>
            {businessCenters.map((bc) => (
              <SelectItem key={bc.id} value={bc.id}>{bc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? ALL)}>
          <SelectTrigger className="w-36">
            <span>{statusFilter === ALL ? "Todos status" : STATUS_LABELS[statusFilter]}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos status</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="pending">Limitada</SelectItem>
            <SelectItem value="suspended">Suspensa</SelectItem>
          </SelectContent>
        </Select>

        <Select value={currencyFilter} onValueChange={(value) => setCurrencyFilter(value ?? ALL)}>
          <SelectTrigger className="w-28">
            <span>{currencyFilter === ALL ? "Moeda" : currencyFilter}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Moeda</SelectItem>
            {currencies.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={accounts.length === 0 ? "Nenhuma conta de anúncio ainda" : "Nada encontrado"}
          description={
            accounts.length === 0
              ? "Conecte seu TikTok Ads em Integrações para trazer suas contas aqui."
              : "Tente ajustar a busca ou os filtros."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="micro-label px-4 py-3">Conta</th>
                <th className="micro-label px-4 py-3">Business Center</th>
                <th className="micro-label px-4 py-3">Moeda</th>
                <th className="micro-label px-4 py-3">Status</th>
                <th className="micro-label px-4 py-3 text-right">Saldo</th>
                <th className="micro-label px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((account) => (
                <tr key={account.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{account.name}</p>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs text-text-faint">{account.advertiserId}</span>
                      <CopyButton value={account.advertiserId} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{account.bcName}</td>
                  <td className="px-4 py-3 text-text-muted">{account.currency}</td>
                  <td className="px-4 py-3">
                    {account.isLimited ? (
                      <Badge className="border-none bg-warning/10 text-warning">Limitada</Badge>
                    ) : account.status === "active" ? (
                      <Badge className="border-none bg-success/10 text-success">Ativa</Badge>
                    ) : (
                      <Badge className="border-none bg-danger/10 text-danger">Suspensa</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {account.canReadFinance && account.balance !== null ? (
                      formatCurrency(account.balance, account.currency)
                    ) : (
                      <span className="text-text-faint">Sem permissão financeira</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`https://ads.tiktok.com/i18n/perf/campaign?aadvid=${account.advertiserId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Abrir no TikTok <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
