import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client com a service_role key — ignora RLS. Uso restrito a código de
 * servidor de confiança (sync jobs, tabelas com segredo como
 * tiktok_connections). Nunca importar isto em um Client Component.
 * Todo filtro por org_id precisa ser feito manualmente pelo chamador.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
