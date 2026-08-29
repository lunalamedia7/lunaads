import { Plug } from "lucide-react";
import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { TikTokConnectionCard } from "@/components/integracoes/tiktok-connection-card";
import { CheckoutIntegrationsSection } from "@/components/integracoes/checkout-integrations-section";
import { EmptyState } from "@/components/empty-state";

export default async function IntegracoesPage() {
  const org = await getCurrentOrg();

  if (!org) {
    return (
      <EmptyState icon={Plug} title="Não foi possível carregar sua organização" />
    );
  }

  const db = createServiceClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const [{ data: connection }, { count: bcCount }, { count: accountCount }, { data: checkoutIntegrations }, { data: failedEvents }] =
    await Promise.all([
      db
        .from("tiktok_connections")
        .select("status, last_synced_at")
        .eq("org_id", org.id)
        .maybeSingle(),
      db.from("business_centers").select("id", { count: "exact", head: true }).eq("org_id", org.id),
      db.from("ad_accounts").select("id", { count: "exact", head: true }).eq("org_id", org.id),
      db
        .from("checkout_integrations")
        .select("id, platform, is_active, webhook_token")
        .eq("org_id", org.id)
        .order("created_at"),
      db
        .from("webhook_events")
        .select("id, platform, error, created_at")
        .eq("org_id", org.id)
        .not("error", "is", null)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Integrações</h1>
        <p className="mt-1 text-sm text-text-muted">
          Conecte seu TikTok Ads e plataformas de checkout.
        </p>
      </div>

      <TikTokConnectionCard
        status={connection?.status ?? "disconnected"}
        lastSyncedAt={connection?.last_synced_at ?? null}
        bcCount={bcCount ?? 0}
        accountCount={accountCount ?? 0}
      />

      <CheckoutIntegrationsSection
        integrations={(checkoutIntegrations ?? []).map((integration) => ({
          id: integration.id,
          platform: integration.platform,
          isActive: integration.is_active,
          webhookUrl: `${origin}/api/webhooks/${integration.platform}/${integration.webhook_token}`,
        }))}
        failedEvents={(failedEvents ?? []).map((event) => ({
          id: event.id,
          platform: event.platform,
          error: event.error ?? "",
          createdAt: event.created_at,
        }))}
      />
    </div>
  );
}
