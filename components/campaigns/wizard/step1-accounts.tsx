"use client";

import { useMemo, useState } from "react";
import { Search, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

export type AccountOption = {
  id: string;
  name: string;
  advertiserId: string;
  bcId: string;
  bcName: string;
  isLimited: boolean;
  canReadFinance: boolean;
  balance: number | null;
};

export function Step1Accounts({
  accounts,
  selectedIds,
  onChange,
  error,
}: {
  accounts: AccountOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? accounts.filter((a) => `${a.name} ${a.advertiserId}`.toLowerCase().includes(q))
      : accounts;
    const map = new Map<string, { bcName: string; accounts: AccountOption[] }>();
    for (const account of filtered) {
      const group = map.get(account.bcId) ?? { bcName: account.bcName, accounts: [] };
      group.accounts.push(account);
      map.set(account.bcId, group);
    }
    return Array.from(map.entries());
  }, [accounts, query]);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  function toggleAllInBc(bcAccounts: AccountOption[]) {
    const ids = bcAccounts.map((a) => a.id);
    const allSelected = ids.every((id) => selectedIds.includes(id));
    onChange(
      allSelected
        ? selectedIds.filter((id) => !ids.includes(id))
        : Array.from(new Set([...selectedIds, ...ids])),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Selecione as contas</h2>
        <p className="text-sm text-text-muted">
          A campanha será publicada em cada conta selecionada. {selectedIds.length} selecionada
          {selectedIds.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
        <Input
          placeholder="Buscar conta..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex max-h-[420px] flex-col gap-4 overflow-y-auto rounded-xl border border-border p-3">
        {grouped.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-faint">Nenhuma conta encontrada.</p>
        ) : (
          grouped.map(([bcId, group]) => {
            const allSelected = group.accounts.every((a) => selectedIds.includes(a.id));
            return (
              <div key={bcId}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="micro-label">{group.bcName}</p>
                  <button
                    type="button"
                    onClick={() => toggleAllInBc(group.accounts)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {allSelected ? "Desmarcar todas" : "Selecionar todas do BC"}
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  {group.accounts.map((account) => (
                    <label
                      key={account.id}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-secondary"
                    >
                      <Checkbox
                        checked={selectedIds.includes(account.id)}
                        onCheckedChange={() => toggle(account.id)}
                      />
                      <span className="flex-1 truncate text-sm text-foreground">{account.name}</span>
                      <span className="font-mono text-xs text-text-faint">{account.advertiserId}</span>
                      {account.isLimited || !account.canReadFinance || account.balance === 0 ? (
                        <Badge className="gap-1 border-none bg-warning/10 text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          {account.isLimited ? "Limitada" : "Sem saldo/permissão"}
                        </Badge>
                      ) : null}
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
