import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessToken } from "@/lib/tiktok/connection";
import { getTikTokProvider } from "@/lib/tiktok";
import { buildAppealText } from "@/lib/appeals/templates";

/**
 * Só o estratégia "api" (Smart+) pode ser automatizada de ponta a ponta —
 * é a única coberta por endpoint oficial de apelação (Bloco C). A
 * estratégia "assisted" sempre exige uma ação manual do operador.
 */
export async function processDueAutoAppeals(): Promise<{ processed: number; paused: string[] }> {
  const db = createServiceClient();
  const paused: string[] = [];

  const { data: settingsRows } = await db
    .from("appeal_settings")
    .select("*")
    .eq("auto_appeal_enabled", true);

  let processed = 0;

  for (const settings of settingsRows ?? []) {
    const { data: recent } = await db
      .from("appeals")
      .select("status")
      .eq("org_id", settings.org_id)
      .in("status", ["sent", "approved", "failed"])
      .order("updated_at", { ascending: false })
      .limit(50);

    if (recent && recent.length >= 10) {
      const failures = recent.filter((r) => r.status === "failed").length;
      const rate = failures / recent.length;
      if (rate > settings.failure_pause_threshold) {
        await db
          .from("appeal_settings")
          .update({
            auto_appeal_enabled: false,
            paused_reason: `Pausado automaticamente: ${(rate * 100).toFixed(0)}% de falha nas últimas ${recent.length} apelações.`,
            updated_at: new Date().toISOString(),
          })
          .eq("org_id", settings.org_id);
        paused.push(settings.org_id);
        continue;
      }
    }

    const { data: lastSent } = await db
      .from("appeals")
      .select("sent_at")
      .eq("org_id", settings.org_id)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSent?.sent_at) {
      const elapsedSeconds = (Date.now() - new Date(lastSent.sent_at).getTime()) / 1000;
      if (elapsedSeconds < settings.min_interval_seconds) continue;
    }

    const { data: candidate } = await db
      .from("appeals")
      .select("*")
      .eq("org_id", settings.org_id)
      .eq("strategy", "api")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!candidate) continue;

    const { count: sentToday } = await db
      .from("appeals")
      .select("id", { count: "exact", head: true })
      .eq("org_id", settings.org_id)
      .eq("advertiser_id", candidate.advertiser_id)
      .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if ((sentToday ?? 0) >= settings.daily_cap_per_account) continue;

    await submitAppeal(settings.org_id, candidate);
    processed += 1;
  }

  return { processed, paused };
}

export async function submitAppeal(
  orgId: string,
  appeal: {
    id: string;
    advertiser_id: string;
    tiktok_ad_id: string;
    ad_name: string;
    reject_reason: string | null;
  },
): Promise<{ error: string | null }> {
  const db = createServiceClient();
  const text = buildAppealText(appeal.tiktok_ad_id, appeal.ad_name, appeal.reject_reason);

  await db
    .from("appeals")
    .update({ status: "queued", sent_text: text, updated_at: new Date().toISOString() })
    .eq("id", appeal.id);

  try {
    const accessToken = await getAccessToken(orgId);
    const provider = getTikTokProvider();
    const result = await provider.submitSmartPlusAppeal(accessToken, appeal.advertiser_id, appeal.tiktok_ad_id, text);

    await db
      .from("appeals")
      .update({
        status: "sent",
        tiktok_response: result.tiktokResponse,
        attempts: 1,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", appeal.id);

    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    await db
      .from("appeals")
      .update({ status: "failed", tiktok_response: message, updated_at: new Date().toISOString() })
      .eq("id", appeal.id);
    return { error: message };
  }
}
