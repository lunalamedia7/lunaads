"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildAppealText } from "@/lib/appeals/templates";
import { submitAppeal } from "@/lib/appeals/process";
import { syncRejections } from "@/lib/appeals/sync";

export type AppealActionState = { error: string | null; success: string | null };

async function recordAudit(orgId: string, action: string, payload: Record<string, unknown>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("audit_log").insert({
    org_id: orgId,
    actor_id: user?.id ?? null,
    action,
    entity: "appeal",
    payload,
  });
}

export async function toggleAutoAppeal(enabled: boolean): Promise<AppealActionState> {
  const org = await requireRole("admin");
  const db = createServiceClient();

  await db.from("appeal_settings").upsert(
    {
      org_id: org.id,
      auto_appeal_enabled: enabled,
      paused_reason: enabled ? null : undefined,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" },
  );

  await recordAudit(org.id, enabled ? "auto_appeal.enabled" : "auto_appeal.disabled", {});
  revalidatePath("/apelacoes");
  return { error: null, success: null };
}

export async function syncRejectionsNow(): Promise<AppealActionState> {
  const org = await requireRole("operator");
  try {
    const result = await syncRejections(org.id);
    revalidatePath("/apelacoes");
    return { error: null, success: `${result.found} reprovação(ões) encontrada(s).` };
  } catch {
    return { error: "Falha ao sincronizar reprovações. Verifique a conexão com o TikTok Ads.", success: null };
  }
}

export async function appealSelectedAds(appealIds: string[]): Promise<AppealActionState> {
  const org = await requireRole("operator");
  const db = createServiceClient();

  const { data: appeals } = await db
    .from("appeals")
    .select("*")
    .eq("org_id", org.id)
    .in("id", appealIds)
    .eq("status", "pending");

  if (!appeals || appeals.length === 0) {
    return { error: "Nenhuma apelação pendente selecionada.", success: null };
  }

  let apiCount = 0;
  let assistedCount = 0;

  for (const appeal of appeals) {
    if (appeal.strategy === "api") {
      await submitAppeal(org.id, appeal);
      apiCount += 1;
    } else {
      const text = buildAppealText(appeal.tiktok_ad_id, appeal.ad_name, appeal.reject_reason);
      await db
        .from("appeals")
        .update({
          status: "sent",
          sent_text: text,
          sent_at: new Date().toISOString(),
          tiktok_response: "assisted_flow: texto entregue ao operador",
          updated_at: new Date().toISOString(),
        })
        .eq("id", appeal.id);
      assistedCount += 1;
    }
  }

  await recordAudit(org.id, "appeal.sent_batch", { apiCount, assistedCount });
  revalidatePath("/apelacoes");
  return {
    error: null,
    success: `${apiCount} via API, ${assistedCount} via fluxo assistido.`,
  };
}

export async function getAppealPreviewText(adId: string, adName: string, rejectReason: string | null) {
  return buildAppealText(adId, adName, rejectReason);
}
