import { Radar } from "lucide-react";
import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { EmptyState } from "@/components/empty-state";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TrackingView, type AttributionSettings, type DomainSummary } from "@/components/tracking/tracking-view";

export default async function TrackingPage() {
  const org = await getCurrentOrg();
  if (!org) return <EmptyState icon={Radar} title="Não foi possível carregar sua organização" />;

  const db = createServiceClient();
  const [{ data: settingsRaw }, { data: domainsRaw }] = await Promise.all([
    db.from("attribution_settings").select("*").eq("org_id", org.id).maybeSingle(),
    db.from("tracking_domains").select("domain, last_seen_at").eq("org_id", org.id).order("last_seen_at", { ascending: false }),
  ]);

  const settings: AttributionSettings = {
    windowHours: settingsRaw?.window_hours ?? 168,
    model: settingsRaw?.model ?? "last_click",
  };

  const domains: DomainSummary[] = (domainsRaw ?? []).map((d) => ({
    domain: d.domain,
    lastSeenAt: d.last_seen_at,
  }));

  return (
    <>
      <RealtimeRefresh orgId={org.id} tables={["tracking_domains"]} />
      <TrackingView settings={settings} domains={domains} />
    </>
  );
}
