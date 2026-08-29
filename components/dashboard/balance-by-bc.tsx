import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Building } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export type BcBalanceRow = {
  id: string;
  name: string;
  currency: string;
  balance: number | null;
  canReadFinance: boolean;
  status: string;
};

export function BalanceByBc({ rows }: { rows: BcBalanceRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Saldo por Business Center</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={Building}
            title="Nenhum BC conectado"
            description="Conecte seu TikTok Ads em Integrações."
            className="py-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="micro-label px-2 py-2">Business Center</th>
                  <th className="micro-label px-2 py-2 text-right">Saldo</th>
                  <th className="micro-label px-2 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((bc) => (
                  <tr key={bc.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-2 text-foreground">{bc.name}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {bc.canReadFinance && bc.balance !== null ? (
                        formatCurrency(bc.balance, bc.currency)
                      ) : (
                        <span className="text-text-faint">Sem permissão</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span
                        className={
                          bc.status === "active" ? "text-success" : "text-danger"
                        }
                      >
                        {bc.status === "active" ? "Ativo" : "Suspenso"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
