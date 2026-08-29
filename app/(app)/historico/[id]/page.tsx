import { notFound } from "next/navigation";
import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { BatchDetail, type BatchRow, type JobRow } from "@/components/historico/batch-detail";

export default async function HistoricoBatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getCurrentOrg();
  if (!org) notFound();

  const db = createServiceClient();
  const { data: batch } = await db
    .from("publish_batches")
    .select("id, total, done, failed, mode, status")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();

  if (!batch) notFound();

  const { data: jobs } = await db
    .from("publish_jobs")
    .select("id, advertiser_id, status, step, error_code, error_message, request_id, tiktok_campaign_id, sequence")
    .eq("batch_id", id)
    .order("sequence");

  const batchRow: BatchRow = {
    id: batch.id,
    total: batch.total,
    done: batch.done,
    failed: batch.failed,
    mode: batch.mode,
    status: batch.status,
  };

  const jobRows: JobRow[] = (jobs ?? []).map((job) => ({
    id: job.id,
    advertiserId: job.advertiser_id,
    status: job.status,
    step: job.step,
    errorCode: job.error_code,
    errorMessage: job.error_message,
    requestId: job.request_id,
    tiktokCampaignId: job.tiktok_campaign_id,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Detalhe do lote</h1>
        <p className="mt-1 text-sm text-text-muted">Progresso ao vivo da publicação.</p>
      </div>
      <BatchDetail batchId={id} initialBatch={batchRow} initialJobs={jobRows} />
    </div>
  );
}
