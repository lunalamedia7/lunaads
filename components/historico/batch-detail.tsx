"use client";

import { useEffect, useState } from "react";
import { RotateCcw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { reprocessBatchFailures } from "@/lib/actions/publish";

export type JobRow = {
  id: string;
  advertiserId: string;
  status: string;
  step: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestId: string | null;
  tiktokCampaignId: string | null;
};

export type BatchRow = {
  id: string;
  total: number;
  done: number;
  failed: number;
  mode: string;
  status: string;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  queued: { label: "Aguardando", className: "bg-secondary text-text-muted" },
  running: { label: "Publicando", className: "bg-warning/10 text-warning" },
  ok: { label: "OK", className: "bg-success/10 text-success" },
  failed: { label: "Falhou", className: "bg-danger/10 text-danger" },
};

export function BatchDetail({
  batchId,
  initialBatch,
  initialJobs,
}: {
  batchId: string;
  initialBatch: BatchRow;
  initialJobs: JobRow[];
}) {
  const [batch, setBatch] = useState(initialBatch);
  const [jobs, setJobs] = useState(initialJobs);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`batch-${batchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "publish_batches", filter: `id=eq.${batchId}` },
        (payload) => {
          const row = payload.new as { total: number; done: number; failed: number; mode: string; status: string };
          setBatch((prev) => ({ ...prev, ...row }));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "publish_jobs", filter: `batch_id=eq.${batchId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            advertiser_id: string;
            status: string;
            step: string | null;
            error_code: string | null;
            error_message: string | null;
            request_id: string | null;
            tiktok_campaign_id: string | null;
          };
          setJobs((prev) => {
            const updated: JobRow = {
              id: row.id,
              advertiserId: row.advertiser_id,
              status: row.status,
              step: row.step,
              errorCode: row.error_code,
              errorMessage: row.error_message,
              requestId: row.request_id,
              tiktokCampaignId: row.tiktok_campaign_id,
            };
            const exists = prev.some((j) => j.id === row.id);
            return exists ? prev.map((j) => (j.id === row.id ? updated : j)) : [...prev, updated];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [batchId]);

  async function handleReprocess() {
    setReprocessing(true);
    setReprocessError(null);
    const result = await reprocessBatchFailures(batchId);
    if (result.error) setReprocessError(result.error);
    setReprocessing(false);
  }

  const percent = batch.total > 0 ? Math.round(((batch.done + batch.failed) / batch.total) * 100) : 0;
  const hasFailed = jobs.some((j) => j.status === "failed");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-text-muted">
            {batch.done + batch.failed} de {batch.total} concluídas
          </span>
          <span className="tabular-nums text-text-muted">{percent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {hasFailed ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handleReprocess} disabled={reprocessing}>
            <RotateCcw className="h-4 w-4" />
            {reprocessing ? "Reprocessando..." : "Reprocessar apenas os que falharam"}
          </Button>
          {reprocessError ? <p className="text-sm text-danger">{reprocessError}</p> : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => {
          const status = STATUS_LABELS[job.status] ?? STATUS_LABELS.queued;
          return (
            <Card key={job.id}>
              <CardContent className="flex flex-col gap-2 pt-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-text-faint">{job.advertiserId}</span>
                  <Badge className={`border-none ${status.className}`}>{status.label}</Badge>
                </div>
                {job.status === "failed" ? (
                  <p className="text-xs text-danger">
                    {job.errorCode}: {job.errorMessage}
                    {job.requestId ? ` (request_id: ${job.requestId})` : ""}
                  </p>
                ) : null}
                {job.tiktokCampaignId ? (
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    Ver campanha <ExternalLink className="h-3 w-3" />
                  </span>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
