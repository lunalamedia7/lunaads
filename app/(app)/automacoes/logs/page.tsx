import { ScrollText } from "lucide-react";
import { getCurrentOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { RealtimeRefresh } from "@/components/realtime-refresh";

const DECISION_LABELS: Record<string, { label: string; className: string }> = {
  would_act: { label: "Simularia ação", className: "bg-warning/10 text-warning" },
  acted: { label: "Agiu", className: "bg-success/10 text-success" },
  skipped_condition: { label: "Condição falsa", className: "bg-secondary text-text-muted" },
  skipped_cooldown: { label: "Cooldown", className: "bg-secondary text-text-muted" },
  skipped_guardrail: { label: "Limite de segurança", className: "bg-secondary text-text-muted" },
};

export default async function AutomacoesLogsPage() {
  const org = await getCurrentOrg();
  if (!org) return <EmptyState icon={ScrollText} title="Não foi possível carregar sua organização" />;

  const db = createServiceClient();
  const { data: logsRaw } = await db
    .from("automation_run_logs")
    .select("id, entity_name, decision, action_type, value_before, value_after, result, error_message, created_at, automation_rules(name)")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const logs = (logsRaw ?? []).map((l) => {
    const rule = Array.isArray(l.automation_rules) ? l.automation_rules[0] : l.automation_rules;
    return { ...l, ruleName: rule?.name ?? "—" };
  });

  return (
    <div className="flex flex-col gap-6">
      <RealtimeRefresh orgId={org.id} tables={["automation_run_logs"]} />
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Logs de automações</h1>
        <p className="mt-1 text-sm text-text-muted">Timeline por execução das suas regras.</p>
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nenhuma execução ainda" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="micro-label px-3 py-3">Data</th>
                <th className="micro-label px-3 py-3">Regra</th>
                <th className="micro-label px-3 py-3">Objeto</th>
                <th className="micro-label px-3 py-3">Decisão</th>
                <th className="micro-label px-3 py-3">Antes → Depois</th>
                <th className="micro-label px-3 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const decision = DECISION_LABELS[log.decision] ?? DECISION_LABELS.skipped_condition;
                return (
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 text-text-faint">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5 text-text-muted">{log.ruleName}</td>
                    <td className="px-3 py-2.5 text-foreground">{log.entity_name}</td>
                    <td className="px-3 py-2.5">
                      <Badge className={`border-none ${decision.className}`}>{decision.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-faint">
                      {log.value_before ? JSON.stringify(log.value_before) : "—"}
                      {log.value_after ? ` → ${JSON.stringify(log.value_after)}` : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      {log.result === "error" ? (
                        <span className="text-danger">{log.error_message ?? "erro"}</span>
                      ) : log.result === "dry_run" ? (
                        <span className="text-warning">simulado</span>
                      ) : (
                        <span className="text-success">ok</span>
                      )}
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
