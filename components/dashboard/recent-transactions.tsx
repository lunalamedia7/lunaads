"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export type SaleRow = {
  id: string;
  platform: string;
  status: string;
  grossAmount: number;
  currency: string;
  occurredAt: string;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  paid: { label: "Pago", className: "bg-success/10 text-success" },
  pending: { label: "Pendente", className: "bg-warning/10 text-warning" },
  initiated: { label: "Iniciado", className: "bg-secondary text-text-muted" },
  refunded: { label: "Reembolsado", className: "bg-danger/10 text-danger" },
  chargeback: { label: "Chargeback", className: "bg-danger/10 text-danger" },
};

export function RecentTransactions({ orgId, initialSales }: { orgId: string; initialSales: SaleRow[] }) {
  // initialSales só muda quando o pai é remontado (veja key={period} onde é usado) —
  // por isso não precisa de um efeito para resincronizar o estado com a prop.
  const [sales, setSales] = useState(initialSales);
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`recent-sales-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            platform: string;
            status: string;
            gross_amount: number;
            currency: string;
            occurred_at: string;
          };
          setSales((prev) => {
            const withoutRow = prev.filter((s) => s.id !== row.id);
            const updated: SaleRow = {
              id: row.id,
              platform: row.platform,
              status: row.status,
              grossAmount: Number(row.gross_amount),
              currency: row.currency,
              occurredAt: row.occurred_at,
            };
            return [updated, ...withoutRow].slice(0, 20);
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  const last24h = sales.filter(
    (s) => mountedAt - new Date(s.occurredAt).getTime() < 24 * 60 * 60 * 1000,
  ).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Transações recentes</CardTitle>
        {last24h > 0 ? (
          <Badge className="border-none bg-accent-soft text-primary">
            {last24h} nas últimas 24h
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nenhuma venda ainda"
            description="Conecte uma plataforma de checkout em Integrações."
            className="py-8"
          />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {sales.map((sale) => {
              const status = STATUS_LABELS[sale.status] ?? STATUS_LABELS.initiated;
              return (
                <div key={sale.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className={`border-none ${status.className}`}>{status.label}</Badge>
                    <span className="capitalize text-text-muted">{sale.platform}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-faint">
                      {new Date(sale.occurredAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span
                      className={`tabular-nums font-medium ${sale.status === "paid" ? "text-success" : "text-foreground"}`}
                    >
                      {formatCurrency(sale.grossAmount, sale.currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
