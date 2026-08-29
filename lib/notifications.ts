import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

export type NotificationType =
  | "saldo_baixo"
  | "conta_limitada"
  | "criativo_reprovado"
  | "lote_concluido"
  | "lote_falhou"
  | "automacao_disparada";

/**
 * notifications é por user_id (Fase 1), não por org_id — pra avisar todo
 * mundo da org, cria uma linha por membro. Roda sempre via service_role
 * (chamado só de cron jobs/engines de servidor).
 */
export async function notifyOrg(
  orgId: string,
  notification: { type: NotificationType; title: string; body?: string; link?: string },
): Promise<void> {
  const db = createServiceClient();
  const { data: members } = await db.from("org_members").select("user_id").eq("org_id", orgId);
  if (!members || members.length === 0) return;

  await db.from("notifications").insert(
    members.map((m) => ({
      org_id: orgId,
      user_id: m.user_id,
      type: notification.type,
      title: notification.title,
      body: notification.body ?? null,
      link: notification.link ?? null,
    })),
  );
}
