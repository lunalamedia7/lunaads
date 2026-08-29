import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { EmptyState } from "@/components/empty-state";
import { Zap } from "lucide-react";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { RulesList, type RuleRow } from "@/components/automations/rules-list";

export default async function AutomacoesPage() {
  const org = await getCurrentOrg();
  if (!org) return <EmptyState icon={Zap} title="Não foi possível carregar sua organização" />;

  const db = createServiceClient();
  const [{ data: rulesRaw }, { data: accounts }, { data: businessCenters }] = await Promise.all([
    db.from("automation_rules").select("*").eq("org_id", org.id).order("created_at", { ascending: false }),
    db.from("ad_accounts").select("id, name").eq("org_id", org.id).order("name"),
    db.from("business_centers").select("id, name, alias").eq("org_id", org.id).order("name"),
  ]);

  const rules: RuleRow[] = (rulesRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    isDryRun: r.is_dry_run,
    isActive: r.is_active,
    dryRunUntil: r.dry_run_until,
    condition: r.condition,
    action: r.action,
  }));

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh orgId={org.id} tables={["automation_rules"]} />
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Automações</h1>
        <p className="mt-1 text-sm text-text-muted">Regras que rodam sozinhas na sua operação.</p>
      </div>
      <RulesList
        rules={rules}
        accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.name }))}
        businessCenters={(businessCenters ?? []).map((b) => ({ id: b.id, name: b.alias || b.name }))}
      />
    </div>
  );
}
