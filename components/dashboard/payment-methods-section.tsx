import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethodBreakdown } from "@/lib/dashboard";

const METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  card: "Cartão",
  boleto: "Boleto",
  outro: "Outro",
};

export function PaymentMethodsSection({ data }: { data: PaymentMethodBreakdown[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vendas por método de pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Nenhuma venda no período"
            className="py-8"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {data.map((row) => (
              <div key={row.method} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{METHOD_LABELS[row.method] ?? row.method}</span>
                <div className="flex items-center gap-4">
                  <span className="tabular-nums text-text-muted">
                    {row.paidCount} vendas · {formatCurrency(row.grossRevenue, "BRL")}
                  </span>
                  <span className="tabular-nums w-14 text-right font-medium text-foreground">
                    {row.approvalRate === null ? "N/A" : `${(row.approvalRate * 100).toFixed(0)}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
