import { Target } from "lucide-react";
import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { daysAgoIso, hoursAgoIso } from "@/lib/time";
import { EmptyState } from "@/components/empty-state";
import { PixelView, type PixelRow, type DomainRow } from "@/components/pixel/pixel-view";

export default async function PixelPage() {
  const org = await getCurrentOrg();
  if (!org) return <EmptyState icon={Target} title="Não foi possível carregar sua organização" />;

  const db = createServiceClient();
  const [{ data: pixelsRaw }, { data: domainsRaw }, { data: eventsRaw }] = await Promise.all([
    db.from("pixels").select("id, tiktok_pixel_id, name").eq("org_id", org.id),
    db.from("tracking_domains").select("domain, last_seen_at").eq("org_id", org.id).order("last_seen_at", { ascending: false }),
    db
      .from("tracking_events")
      .select("domain, event_type")
      .eq("org_id", org.id)
      .gte("occurred_at", daysAgoIso(30)),
  ]);

  const eventTypesByDomain = new Map<string, Set<string>>();
  for (const e of eventsRaw ?? []) {
    const set = eventTypesByDomain.get(e.domain) ?? new Set<string>();
    set.add(e.event_type);
    eventTypesByDomain.set(e.domain, set);
  }

  const pixels: PixelRow[] = (pixelsRaw ?? []).map((p) => ({
    id: p.id,
    tiktokPixelId: p.tiktok_pixel_id,
    name: p.name,
  }));

  const recentCutoff = hoursAgoIso(48);
  const domains: DomainRow[] = (domainsRaw ?? []).map((d) => ({
    domain: d.domain,
    lastSeenAt: d.last_seen_at,
    eventTypes: Array.from(eventTypesByDomain.get(d.domain) ?? []),
    isRecent: Boolean(d.last_seen_at && d.last_seen_at > recentCutoff),
  }));

  const scriptSnippet = `<script>\n  window.lunaadsConfig = { token: "${org.slug}" };\n</script>\n<script src="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/t.js" async></script>`;

  return <PixelView pixels={pixels} domains={domains} scriptSnippet={scriptSnippet} />;
}
