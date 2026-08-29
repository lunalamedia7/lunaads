"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Building } from "lucide-react";
import {
  BusinessCenterCard,
  type BusinessCenterCardData,
} from "@/components/business-centers/business-center-card";

export function BusinessCentersView({ businessCenters }: { businessCenters: BusinessCenterCardData[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return businessCenters;
    return businessCenters.filter((bc) =>
      [bc.name, bc.alias ?? "", bc.bcId, bc.companyName].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [businessCenters, query]);

  const activeCount = businessCenters.filter((bc) => bc.status === "active").length;
  const totalAccounts = businessCenters.reduce((sum, bc) => sum + bc.accountCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6">
        <Stat label="BCs" value={businessCenters.length} />
        <Stat label="Ativas" value={activeCount} />
        <Stat label="Advertisers" value={totalAccounts} />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
        <Input
          placeholder="Buscar por nome, ID ou empresa..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building}
          title={businessCenters.length === 0 ? "Nenhum Business Center conectado" : "Nada encontrado"}
          description={
            businessCenters.length === 0
              ? "Conecte seu TikTok Ads em Integrações para trazer seus BCs aqui."
              : "Tente buscar por outro nome, ID ou empresa."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((bc) => (
            <BusinessCenterCard key={bc.id} bc={bc} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="micro-label">{label}</p>
      <p className="tabular-nums text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
