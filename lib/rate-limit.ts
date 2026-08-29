import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Janela fixa (fixed window) baseada em Postgres — suficiente pra proteger
 * rotas públicas (webhook de checkout, coletor do pixel) sem precisar de
 * Redis/Upstash (mais uma conta externa). `key` já deve incluir o escopo
 * (ex.: `webhook:<token>`, `collect:<domain>`).
 */
export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowSeconds: number },
): Promise<{ allowed: boolean; count: number }> {
  const db = createServiceClient();
  const bucketMs = opts.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / bucketMs) * bucketMs).toISOString();

  const { data: count, error } = await db.rpc("increment_rate_limit", {
    p_key: key,
    p_window_start: windowStart,
  });

  // Se o rate limiter em si falhar, não derruba a rota — deixa passar.
  if (error || count === null) return { allowed: true, count: 0 };

  return { allowed: count <= opts.limit, count };
}
