import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessToken, TikTokNeedsReauthError } from "@/lib/tiktok/connection";
import { getTikTokProvider } from "@/lib/tiktok";
import { TikTokApiError } from "@/lib/tiktok/types";
import { generateCampaignName, normalizeAdGroups, type WizardData } from "@/lib/campaigns/schema";
import { notifyOrg } from "@/lib/notifications";

type CreatedTreeAd = { adIndex: number; tiktokAdId: string | null };
type CreatedTreeAdGroup = { adGroupIndex: number; tiktokAdgroupId: string | null; ads: CreatedTreeAd[] };
type CreatedTree = CreatedTreeAdGroup[];

const SAFE_MIN_DELAY_MS = 45_000;
const SAFE_MAX_DELAY_MS = 90_000;
const FAST_DELAY_MS = 2_000;
const MAX_ATTEMPTS = 5;

function nextDelayMs(mode: string) {
  if (mode === "fast") return FAST_DELAY_MS;
  return SAFE_MIN_DELAY_MS + Math.random() * (SAFE_MAX_DELAY_MS - SAFE_MIN_DELAY_MS);
}

export async function createPublishBatch(params: {
  orgId: string;
  userId: string;
  wizardData: WizardData;
  accounts: { id: string; advertiserId: string }[];
  mode: "safe" | "fast";
}): Promise<string> {
  const db = createServiceClient();

  const { data: batch, error } = await db
    .from("publish_batches")
    .insert({
      org_id: params.orgId,
      template_snapshot: params.wizardData,
      total: params.accounts.length,
      mode: params.mode,
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (error || !batch) throw new Error("Não foi possível criar o lote de publicação.");

  const jobs = params.accounts.map((account, index) => ({
    batch_id: batch.id,
    org_id: params.orgId,
    ad_account_id: account.id,
    advertiser_id: account.advertiserId,
    sequence: index,
    idempotency_key: `${batch.id}:${account.id}`,
    next_run_at: index === 0 ? new Date().toISOString() : null,
  }));

  const { error: jobsError } = await db.from("publish_jobs").insert(jobs);
  if (jobsError) throw new Error("Não foi possível criar os jobs de publicação.");

  return batch.id;
}

/**
 * Processa os jobs "devidos" (um por lote ativo, respeitando o espaçamento).
 * Chamado pelo cron da Vercel — nunca depende de uma aba de navegador aberta.
 */
export async function processDuePublishJobs(): Promise<{ processed: number }> {
  const db = createServiceClient();

  const { data: dueJobs } = await db
    .from("publish_jobs")
    .select("id, batch_id")
    .eq("status", "queued")
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true });

  if (!dueJobs || dueJobs.length === 0) return { processed: 0 };

  const seenBatches = new Set<string>();
  const toProcess: string[] = [];
  for (const job of dueJobs) {
    if (seenBatches.has(job.batch_id)) continue;
    seenBatches.add(job.batch_id);
    toProcess.push(job.id);
  }

  for (const jobId of toProcess) {
    await processJob(jobId);
  }

  return { processed: toProcess.length };
}

async function processJob(jobId: string): Promise<void> {
  const db = createServiceClient();

  const { data: job } = await db.from("publish_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job || job.status !== "queued") return;

  const { data: batch } = await db
    .from("publish_batches")
    .select("*")
    .eq("id", job.batch_id)
    .maybeSingle();
  if (!batch) return;

  await db
    .from("publish_jobs")
    .update({ status: "running", attempt: job.attempt + 1, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    const accessToken = await getAccessToken(job.org_id);
    const provider = getTikTokProvider();
    const wizardData = batch.template_snapshot as WizardData;
    const step2 = wizardData.step2!;
    const adGroupsSpec = normalizeAdGroups(wizardData);

    let campaignId = job.tiktok_campaign_id;
    const campaignName = generateCampaignName(step2.namePattern!, job.sequence);

    if (!campaignId) {
      await setStep(jobId, "campaign");
      const result = await provider.createCampaign(accessToken, {
        advertiserId: job.advertiser_id,
        name: campaignName,
        objective: step2.objective!,
        budgetMode: step2.budgetMode!,
        budgetAmount: step2.budgetAmount!,
      });
      campaignId = result.campaignId;
      await db.from("publish_jobs").update({ tiktok_campaign_id: campaignId }).eq("id", jobId);
    }

    const { data: campaignRow } = await db
      .from("campaigns")
      .upsert(
        {
          org_id: job.org_id,
          ad_account_id: job.ad_account_id,
          tiktok_campaign_id: campaignId,
          name: campaignName,
          objective: step2.objective,
          status: "active",
          budget_mode: step2.budgetMode,
          budget_amount: step2.budgetAmount,
        },
        { onConflict: "org_id,tiktok_campaign_id" },
      )
      .select("id")
      .single();

    // Suporta tanto o Estilo Fast (1 conjunto/1 anúncio) quanto o Estilo
    // Builder (N conjuntos/M anúncios) com o MESMO motor: created_tree guarda
    // o progresso de cada item pra retomar sem duplicar em caso de retry.
    const tree: CreatedTree = mergeCreatedTree(job.created_tree, adGroupsSpec);

    for (let i = 0; i < adGroupsSpec.length; i++) {
      const groupSpec = adGroupsSpec[i].config;
      const groupNode = tree[i];
      const groupSuffix = adGroupsSpec.length > 1 ? `_AG${i + 1}` : "_AG";

      if (!groupNode.tiktokAdgroupId) {
        await setStep(jobId, "adgroup");
        const result = await provider.createAdGroup(accessToken, {
          advertiserId: job.advertiser_id,
          campaignId,
          name: `${campaignName}${groupSuffix}`,
          optimizationGoal: groupSpec.optimizationGoal,
          conversionEvent: groupSpec.conversionEvent,
          pixelId: groupSpec.pixelId,
          placementMode: groupSpec.placementMode,
          countries: groupSpec.countries,
          languages: groupSpec.languages,
          ageMin: groupSpec.ageMin,
          ageMax: groupSpec.ageMax,
          genders: groupSpec.genders,
          budgetMode: groupSpec.budgetMode,
          budgetAmount: groupSpec.budgetAmount,
          bidType: groupSpec.bidType,
          bidAmount: groupSpec.bidAmount,
          startDate: groupSpec.startDate,
          endDate: groupSpec.endDate,
          deliveryType: groupSpec.deliveryType,
        });
        groupNode.tiktokAdgroupId = result.adgroupId;
        await persistTree(jobId, tree);
        if (i === 0) {
          await db.from("publish_jobs").update({ tiktok_adgroup_id: result.adgroupId }).eq("id", jobId);
        }
      }

      const { data: adGroupRow } = campaignRow
        ? await db
            .from("ad_groups")
            .upsert(
              {
                org_id: job.org_id,
                campaign_id: campaignRow.id,
                tiktok_adgroup_id: groupNode.tiktokAdgroupId,
                name: `${campaignName}${groupSuffix}`,
                status: "active",
                budget_mode: groupSpec.budgetMode,
                budget_amount: groupSpec.budgetAmount,
              },
              { onConflict: "org_id,tiktok_adgroup_id" },
            )
            .select("id")
            .single()
        : { data: null };

      const adsSpec = adGroupsSpec[i].ads;
      for (let j = 0; j < adsSpec.length; j++) {
        const adSpec = adsSpec[j];
        const adNode = groupNode.ads[j];
        const adSuffix = adsSpec.length > 1 ? `_AD${j + 1}` : "_AD";

        if (!adNode.tiktokAdId) {
          await setStep(jobId, "ad");
          const result = await provider.createAd(accessToken, {
            advertiserId: job.advertiser_id,
            adgroupId: groupNode.tiktokAdgroupId!,
            name: `${campaignName}${groupSuffix}${adSuffix}`,
            creativeSource: adSpec.creativeSource,
            creativeRef: adSpec.creativeRef,
            adText: adSpec.adText,
            cta: adSpec.cta,
            destinationUrl: buildDestinationUrl(adSpec.destinationUrl, {
              campaignId,
              adgroupId: groupNode.tiktokAdgroupId!,
              advertiserId: job.advertiser_id,
            }),
            identityRef: adSpec.identityRef,
          });
          adNode.tiktokAdId = result.adId;
          await persistTree(jobId, tree);
          if (i === 0 && j === 0) {
            await db.from("publish_jobs").update({ tiktok_ad_id: result.adId }).eq("id", jobId);
          }
        }

        if (adGroupRow) {
          await db.from("ads").upsert(
            {
              org_id: job.org_id,
              ad_group_id: adGroupRow.id,
              tiktok_ad_id: adNode.tiktokAdId,
              name: `${campaignName}${groupSuffix}${adSuffix}`,
              status: "active",
            },
            { onConflict: "org_id,tiktok_ad_id" },
          );
        }
      }
    }

    await db
      .from("publish_jobs")
      .update({ status: "ok", step: "done", error_code: null, error_message: null, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    await db
      .from("publish_batches")
      .update({ done: batch.done + 1, updated_at: new Date().toISOString() })
      .eq("id", batch.id);

    await scheduleNextJob(batch.id, batch.mode);
  } catch (err) {
    await handleJobFailure(job, batch, err);
  }

  await maybeCompleteBatch(job.batch_id);
}

async function setStep(jobId: string, step: string) {
  await createServiceClient().from("publish_jobs").update({ step }).eq("id", jobId);
}

/**
 * Reconstrói a árvore de progresso a partir do que já foi salvo (`created_tree`)
 * cruzando com a especificação atual (adGroupsSpec) — permite retomar um job
 * que falhou no meio (ex.: 2º conjunto, 1º anúncio) sem recriar o que já existe.
 */
function mergeCreatedTree(
  raw: unknown,
  spec: { config: unknown; ads: unknown[] }[],
): CreatedTree {
  const existing = Array.isArray(raw) ? (raw as CreatedTree) : [];
  return spec.map((group, i) => {
    const existingGroup = existing[i];
    return {
      adGroupIndex: i,
      tiktokAdgroupId: existingGroup?.tiktokAdgroupId ?? null,
      ads: group.ads.map((_, j) => ({
        adIndex: j,
        tiktokAdId: existingGroup?.ads?.[j]?.tiktokAdId ?? null,
      })),
    };
  });
}

async function persistTree(jobId: string, tree: CreatedTree) {
  await createServiceClient().from("publish_jobs").update({ created_tree: tree }).eq("id", jobId);
}

function buildDestinationUrl(
  base: string,
  ids: { campaignId: string; adgroupId: string; advertiserId: string },
): string {
  try {
    const url = new URL(base);
    url.searchParams.set("utm_source", "tiktok");
    url.searchParams.set("utm_medium", "paid");
    url.searchParams.set("utm_campaign", ids.campaignId);
    url.searchParams.set("utm_content", ids.adgroupId);
    url.searchParams.set("utm_term", ids.advertiserId);
    return url.toString();
  } catch {
    return base;
  }
}

async function handleJobFailure(
  job: { id: string; attempt: number; batch_id: string },
  batch: { id: string; mode: string; failed: number },
  err: unknown,
) {
  const db = createServiceClient();

  if (err instanceof TikTokNeedsReauthError) {
    await db
      .from("publish_jobs")
      .update({
        status: "failed",
        error_code: "needs_reauth",
        error_message: err.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    await db.from("publish_batches").update({ failed: batch.failed + 1 }).eq("id", batch.id);
    await scheduleNextJob(batch.id, batch.mode);
    return;
  }

  if (err instanceof TikTokApiError && err.retryable && job.attempt < MAX_ATTEMPTS) {
    // Rate limit / erro transitório: volta pra fila com backoff, sem contar como falha.
    await db
      .from("publish_jobs")
      .update({
        status: "queued",
        next_run_at: new Date(Date.now() + nextDelayMs(batch.mode)).toISOString(),
        error_code: String(err.code),
        error_message: err.message,
        request_id: err.requestId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return;
  }

  const message = err instanceof Error ? err.message : "Erro desconhecido";
  const code = err instanceof TikTokApiError ? String(err.code) : "unknown";
  const requestId = err instanceof TikTokApiError ? err.requestId : null;

  await db
    .from("publish_jobs")
    .update({
      status: "failed",
      error_code: code,
      error_message: message,
      request_id: requestId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await db.from("publish_batches").update({ failed: batch.failed + 1 }).eq("id", batch.id);
  await scheduleNextJob(batch.id, batch.mode);
}

/**
 * Agenda o próximo job ainda não agendado do lote (menor `sequence` com
 * `next_run_at` nulo) — é isso que dá o espaçamento entre publicações,
 * seja depois de um sucesso ou de uma falha definitiva.
 */
async function scheduleNextJob(batchId: string, mode: string) {
  const db = createServiceClient();
  const { data: next } = await db
    .from("publish_jobs")
    .select("id")
    .eq("batch_id", batchId)
    .eq("status", "queued")
    .is("next_run_at", null)
    .order("sequence", { ascending: true })
    .limit(1);

  const nextJob = next?.[0];
  if (nextJob) {
    await db
      .from("publish_jobs")
      .update({ next_run_at: new Date(Date.now() + nextDelayMs(mode)).toISOString() })
      .eq("id", nextJob.id);
  }
}

async function maybeCompleteBatch(batchId: string) {
  const db = createServiceClient();
  const { data: batch } = await db
    .from("publish_batches")
    .select("org_id, total, done, failed")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return;
  if (batch.done + batch.failed >= batch.total) {
    const allFailed = batch.failed > 0 && batch.done === 0;
    await db
      .from("publish_batches")
      .update({ status: allFailed ? "failed" : "completed" })
      .eq("id", batchId);

    await notifyOrg(batch.org_id, {
      type: allFailed ? "lote_falhou" : "lote_concluido",
      title: allFailed ? "Lote de publicação falhou" : "Lote de publicação concluído",
      body: `${batch.done} de ${batch.total} publicada(s) com sucesso${batch.failed > 0 ? `, ${batch.failed} com falha` : ""}.`,
      link: `/historico/${batchId}`,
    });
  }
}

export async function reprocessFailedJobs(batchId: string, orgId: string): Promise<{ error: string | null }> {
  const db = createServiceClient();
  const { data: failedJobs } = await db
    .from("publish_jobs")
    .select("id, sequence")
    .eq("batch_id", batchId)
    .eq("org_id", orgId)
    .eq("status", "failed")
    .order("sequence", { ascending: true });

  if (!failedJobs || failedJobs.length === 0) return { error: "Nenhum job com falha para reprocessar." };

  for (let i = 0; i < failedJobs.length; i++) {
    await db
      .from("publish_jobs")
      .update({
        status: "queued",
        next_run_at: i === 0 ? new Date().toISOString() : null,
        error_code: null,
        error_message: null,
      })
      .eq("id", failedJobs[i].id);
  }

  const { data: batch } = await db
    .from("publish_batches")
    .select("failed")
    .eq("id", batchId)
    .maybeSingle();

  await db
    .from("publish_batches")
    .update({
      status: "running",
      failed: Math.max(0, (batch?.failed ?? failedJobs.length) - failedJobs.length),
    })
    .eq("id", batchId);

  return { error: null };
}
