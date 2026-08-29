import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function KpiCards({
  grossRevenue,
  spend,
  roi,
  profit,
}: {
  grossRevenue: number;
  spend: number;
  roi: number | null;
  profit: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi label="Faturamento bruto" value={formatCurrency(grossRevenue, "BRL")} tone="success" />
      <Kpi label="Gasto com anúncios" value={formatCurrency(spend, "BRL")} tone="neutral" />
      <Kpi label="ROI" value={roi === null ? "—" : `${roi.toFixed(2)}x`} tone="neutral" />
      <Kpi
        label="Lucro"
        value={formatCurrency(profit, "BRL")}
        tone={profit >= 0 ? "success" : "danger"}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "danger" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="micro-label">{label}</p>
        <p
          className={cn(
            "tabular-nums mt-1 text-[28px] font-semibold",
            tone === "success" && "text-success",
            tone === "danger" && "text-danger",
            tone === "neutral" && "text-foreground",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
