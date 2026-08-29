import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Log de erro persistido no Postgres — substitui um serviço externo tipo
 * Sentry (evita mais uma conta pro usuário gerenciar). Nunca deve lançar:
 * um logger que quebra o fluxo principal é pior que não logar nada.
 */
export async function logError(
  source: string,
  err: unknown,
  opts?: { orgId?: string; detail?: Record<string, unknown> },
): Promise<void> {
  try {
    const db = createServiceClient();
    const message = err instanceof Error ? err.message : String(err);
    await db.from("error_logs").insert({
      org_id: opts?.orgId ?? null,
      source,
      message,
      detail: opts?.detail ?? {},
    });
  } catch {
    // Logger não pode derrubar o caller.
  }
}
