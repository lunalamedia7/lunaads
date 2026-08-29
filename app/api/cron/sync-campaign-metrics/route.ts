import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncCampaignMetrics } from "@/lib/campaigns/sync";
import { logError } from "@/lib/error-log";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
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
