import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncCampaignMetrics } from "@/lib/campaigns/sync";
import { logError } from "@/lib/error-log";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  // Header customizado em vez de Authorization: Bearer — esse padrão literal
  // no YAML do GitHub Actions dispara um bloqueio silencioso de anti-abuso
  // em contas novas (o workflow nem chega a registrar o trigger direito).
  return request.headers.get("x-cron-key") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const db = createServiceClient();
  const { data: connections } = await db
    .from("tiktok_connections")
    .select("org_id")
    .eq("status", "connected");

  let orgsUpdated = 0;
  for (const connection of connections ?? []) {
    try {
      await syncCampaignMetrics(connection.org_id);
      orgsUpdated += 1;
    } catch (err) {
      // uma org com erro não deve travar as outras.
      await logError("cron.sync_campaign_metrics", err, { orgId: connection.org_id });
    }
  }

  return NextResponse.json({ ok: true, orgsUpdated });
}
