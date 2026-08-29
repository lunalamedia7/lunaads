import { NextResponse } from "next/server";
import { runDueAutomations } from "@/lib/automations/engine";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  // Header customizado em vez de Authorization: Bearer — esse padrão literal
  // no YAML do GitHub Actions dispara um bloqueio silencioso de anti-abuso
  // em contas novas (o workflow nem chega a registrar o trigger direito).
  return request.headers.get("x-cron-key") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await runDueAutomations();
  return NextResponse.json({ ok: true, ...result });
}
