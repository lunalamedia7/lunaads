"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";

export async function sendTestTrackingEvent(): Promise<{ error: string | null; success: string | null }> {
  const org = await getCurrentOrg();
  if (!org) return { error: "Sessão inválida.", success: null };

  const db = createServiceClient();
  await db.from("tracking_events").insert({
    org_id: org.id,
    domain: "teste-ao-vivo.local",
    event_type: "PageView",
    session_id: `test-${Date.now()}`,
    utm_campaign: "teste_manual",
  });
  await db.from("tracking_domains").upsert(
    { org_id: org.id, domain: "teste-ao-vivo.local", last_seen_at: new Date().toISOString() },
    { onConflict: "org_id,domain" },
  );

  revalidatePath("/tracking");
  return { error: null, success: "Evento de teste enviado — confira na lista de domínios." };
}
