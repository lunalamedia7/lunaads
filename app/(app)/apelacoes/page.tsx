import { ShieldAlert } from "lucide-react";
import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { EmptyState } from "@/components/empty-state";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ApelacoesView, type AppealRow, type AppealSettings } from "@/components/apelacoes/apelacoes-view";

export default async function ApelacoesPage() {
  const org = await getCurrentOrg();
  if (!org) return <EmptyState icon={ShieldAlert} title="Não foi possível carregar sua organização" />;

  const db = createServiceClient();
  const [{ data: appealsRaw }, { data: settingsRaw }, { data: lastSentRow }] = await Promise.all([
    db
      .from("appeals")
      .select("*")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("appeal_settings").select("*").eq("org_id", org.id).maybeSingle(),
    db
      .from("appeals")
      .select("sent_at")
      .eq("org_id", org.id)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const appeals: AppealRow[] = (appealsRaw ?? []).map((a) => ({
    id: a.id,
    status: a.status,
    strategy: a.strategy,
    advertiserId: a.advertiser_id,
    bcId: a.bc_id,
    tiktokAdgroupId: a.tiktok_adgroup_id,
    adName: a.ad_name,
    rejectReason: a.reject_reason,
    tiktokResponse: a.tiktok_response,
    sentText: a.sent_text,
    createdAt: a.created_at,
  }));

  const settings: AppealSettings = {
    autoAppealEnabled: settingsRaw?.auto_appeal_enabled ?? false,
    minIntervalSeconds: settingsRaw?.min_interval_seconds ?? 120,
    dailyCapPerAccount: settingsRaw?.daily_cap_per_account ?? 20,
    pausedReason: settingsRaw?.paused_reason ?? null,
    lastSentAt: lastSentRow?.sent_at ?? null,
  };

  return (
    <>
      <RealtimeRefresh orgId={org.id} tables={["appeals"]} />
      <ApelacoesView appeals={appeals} settings={settings} />
    </>
  );
}
