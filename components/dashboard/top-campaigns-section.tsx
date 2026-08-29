import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Rocket } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { CampaignAttribution } from "@/lib/dashboard";

export function TopCampaignsSection({
  campaigns,
  unattributed,
  hasAnySale,
}: {
  campaigns: CampaignAttribution[];
  unattributed: { grossRevenue: number; percentOfTotal: number };
  hasAnySale: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top campanhas</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasAnySale ? (
          <EmptyState
            icon={Rocket}
            title="Ainda sem vendas atribuídas a campanhas"
            description="A UTM entra automática quando você publica a campanha pelo LunaAds. Por enquanto, vendas de checkout aparecem em 'Sem atribuição' quando não trazem UTM de campanha."
            className="py-8"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {campaigns.slice(0, 10).map((c) => (
              <div key={c.campaign} className="flex items-center justify-between text-sm">
                <span className="truncate text-foreground">{c.campaign}</span>
                <span className="tabular-nums shrink-0 text-text-muted">
                  {formatCurrency(c.grossRevenue, "BRL")} · {c.percentOfTotal.toFixed(0)}%
                </span>
              </div>
            ))}
            {unattributed.grossRevenue > 0 ? (
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-text-faint">Sem atribuição</span>
                <span className="tabular-nums text-text-faint">
                  {formatCurrency(unattributed.grossRevenue, "BRL")} · {unattributed.percentOfTotal.toFixed(0)}%
                </span>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
