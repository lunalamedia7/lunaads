import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncAll } from "@/lib/tiktok/sync";
import { logError } from "@/lib/error-log";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sem secret configurado em dev local
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

  let synced = 0;
  for (const connection of connections ?? []) {
    try {
      await syncAll(connection.org_id);
      synced += 1;
    } catch (err) {
      // conexão individual com erro não deve travar as outras orgs.
      await logError("cron.sync_tiktok", err, { orgId: connection.org_id });
    }
  }

  return NextResponse.json({ ok: true, synced });
}
