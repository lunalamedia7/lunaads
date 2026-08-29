import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Activity } from "lucide-react";

export type SystemStatusCounts = {
  connectedAccounts: number;
  activeAccounts: number;
  limitedAccounts: number;
  businessCenters: number;
};

export type ActivityItem = {
  id: string;
  action: string;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  "org.created": "Organização criada",
  "tiktok.connected": "TikTok Ads conectado",
  "tiktok.disconnected": "TikTok Ads desconectado",
  "tiktok.sync_business_centers": "Business Centers sincronizados",
  "tiktok.sync_ad_accounts": "Contas de anúncio sincronizadas",
  "business_center.renamed": "Business Center renomeado",
  "business_center.disconnected": "Business Center desconectado",
  "checkout_integration.created": "Integração de checkout criada",
};

export function SystemStatusSection({
  counts,
  activity,
}: {
  counts: SystemStatusCounts;
  activity: ActivityItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status do sistema</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Contas conectadas" value={counts.connectedAccounts} />
          <Stat label="Advertisers ativos" value={counts.activeAccounts} />
          <Stat label="Contas limitadas" value={counts.limitedAccounts} tone="warning" />
          <Stat label="Business Centers" value={counts.businessCenters} />
        </div>

        <div className="border-t border-border pt-3">
          {activity.length === 0 ? (
            <EmptyState icon={Activity} title="Nenhuma atividade ainda" className="py-6" />
          ) : (
            <div className="flex flex-col gap-2">
              {activity.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">{ACTION_LABELS[item.action] ?? item.action}</span>
                  <span className="text-xs text-text-faint">
                    {new Date(item.createdAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warning" }) {
  return (
    <div>
      <p className="micro-label">{label}</p>
      <p className={`tabular-nums text-xl font-semibold ${tone === "warning" && value > 0 ? "text-warning" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
