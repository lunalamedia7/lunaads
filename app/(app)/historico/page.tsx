import Link from "next/link";
import { History } from "lucide-react";
import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { RealtimeRefresh } from "@/components/realtime-refresh";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  running: { label: "Em andamento", className: "bg-warning/10 text-warning" },
  completed: { label: "Concluído", className: "bg-success/10 text-success" },
  failed: { label: "Falhou", className: "bg-danger/10 text-danger" },
};

export default async function HistoricoPage() {
  const org = await getCurrentOrg();
  if (!org) return <EmptyState icon={History} title="Não foi possível carregar sua organização" />;

  const db = createServiceClient();
  const { data: batches } = await db
    .from("publish_batches")
    .select("id, total, done, failed, mode, status, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh orgId={org.id} tables={["publish_batches"]} />
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Histórico</h1>
        <p className="mt-1 text-sm text-text-muted">Acompanhe os lotes de publicação em massa.</p>
      </div>

      {!batches || batches.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum lote publicado ainda"
          description="Publique uma campanha em 'Nova campanha' para ver o histórico aqui."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="micro-label px-4 py-3">Data</th>
                <th className="micro-label px-4 py-3">Modo</th>
                <th className="micro-label px-4 py-3">Progresso</th>
                <th className="micro-label px-4 py-3">Status</th>
                <th className="micro-label px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const status = STATUS_LABELS[batch.status] ?? STATUS_LABELS.running;
                return (
                  <tr key={batch.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-4 py-3 text-text-muted">
                      {new Date(batch.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {batch.mode === "safe" ? "Subir com Segurança" : "Rápido"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {batch.done + batch.failed} de {batch.total}
                      {batch.failed > 0 ? <span className="text-danger"> ({batch.failed} falhas)</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`border-none ${status.className}`}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/historico/${batch.id}`} className="text-sm font-medium text-primary hover:underline">
                        Ver detalhes
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
