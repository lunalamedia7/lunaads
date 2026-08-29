"use server";

import { requireRole } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { clearDraft } from "@/lib/actions/campaign-drafts";
import { createPublishBatch, reprocessFailedJobs } from "@/lib/campaigns/publish";
import { step1Schema, step2Schema, normalizeAdGroups, type WizardData } from "@/lib/campaigns/schema";

export type PublishActionState = { error: string | null; batchId: string | null };

export async function startPublishBatch(
  wizardData: WizardData,
  mode: "safe" | "fast",
): Promise<PublishActionState> {
  const org = await requireRole("operator");

  const step1 = step1Schema.safeParse(wizardData.step1 ?? {});
  const step2 = step2Schema.safeParse(wizardData.step2 ?? {});

  if (!step1.success || !step2.success) {
    return { error: "Revise os passos anteriores — algo ficou inválido.", batchId: null };
  }

  let normalized: ReturnType<typeof normalizeAdGroups>;
  try {
    normalized = normalizeAdGroups(wizardData);
  } catch {
    return { error: "Revise os conjuntos e anúncios — algo ficou inválido.", batchId: null };
  }
  if (normalized.length === 0 || normalized.some((group) => group.ads.length === 0)) {
    return { error: "Cada conjunto precisa de pelo menos um anúncio.", batchId: null };
  }

  const supabase = await createClient();
  const { data: accounts, error: accountsError } = await supabase
    .from("ad_accounts")
    .select("id, advertiser_id")
    .eq("org_id", org.id)
    .in("id", step1.data.accountIds);

  if (accountsError || !accounts || accounts.length === 0) {
    return { error: "Nenhuma conta válida selecionada.", batchId: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const batchId = await createPublishBatch({
    orgId: org.id,
    userId: user?.id ?? "",
    wizardData: {
      step1: step1.data,
      step2: step2.data,
      ...(wizardData.adGroups && wizardData.adGroups.length > 0
        ? { adGroups: wizardData.adGroups }
        : { step3: wizardData.step3, step4: wizardData.step4 }),
    },
    accounts: accounts.map((a) => ({ id: a.id, advertiserId: a.advertiser_id })),
    mode,
  });

  await supabase.from("audit_log").insert({
    org_id: org.id,
    action: "publish_batch.started",
    entity: "publish_batch",
    entity_id: batchId,
    payload: { total: accounts.length, mode },
  });

  await clearDraft();

  return { error: null, batchId };
}

export async function reprocessBatchFailures(batchId: string) {
  const org = await requireRole("operator");
  const result = await reprocessFailedJobs(batchId, org.id);
  return result;
}
