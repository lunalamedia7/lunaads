import Link from "next/link";
import { Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type FunnelCounts = {
  pageView: number;
  viewContent: number;
  initiateCheckout: number;
  salesInitiated: number;
  salesPaid: number;
};

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="tabular-nums text-text-faint">
          {value} · {percent}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="funnel-gradient h-full rounded-full" style={{ width: `${Math.max(percent, value > 0 ? 4 : 0)}%` }} />
      </div>
    </div>
  );
}

export function FunnelSection({ pixelDetected, counts }: { pixelDetected: boolean; counts: FunnelCounts }) {
  if (!pixelDetected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil de conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-primary">
              <Target className="h-7 w-7" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-foreground">Falta o script do pixel</p>
            <p className="max-w-sm text-sm text-text-muted">
              Cliques, visitas e checkout iniciado dependem do pixel instalado no seu site.
            </p>
            <Link href="/pixel" className="text-sm font-medium text-primary hover:underline">
              Ativar pixel →
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const max = Math.max(counts.pageView, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Funil de conversão</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Bar label="Cliques / visitas" value={counts.pageView} max={max} />
        <Bar label="Visualizou conteúdo" value={counts.viewContent} max={max} />
        <Bar label="Checkout iniciado" value={counts.initiateCheckout} max={max} />
        <Bar label="Vendas iniciadas" value={counts.salesInitiated} max={max} />
        <Bar label="Vendas aprovadas" value={counts.salesPaid} max={max} />
      </CardContent>
    </Card>
  );
}
