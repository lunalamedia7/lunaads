import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  // Header customizado em vez de Authorization: Bearer — esse padrão literal
  // no YAML do GitHub Actions dispara um bloqueio silencioso de anti-abuso
  // em contas novas (o workflow nem chega a registrar o trigger direito).
  return request.headers.get("x-cron-key") === secret;
}

const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
const ERROR_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const db = createServiceClient();
  const { error: rateLimitError } = await db
    .from("rate_limit_hits")
    .delete()
    .lt("window_start", new Date(Date.now() - RATE_LIMIT_RETENTION_MS).toISOString());

  const { error: errorLogError } = await db
    .from("error_logs")
    .delete()
    .lt("created_at", new Date(Date.now() - ERROR_LOG_RETENTION_MS).toISOString());

  return NextResponse.json({ ok: !rateLimitError && !errorLogError });
}
