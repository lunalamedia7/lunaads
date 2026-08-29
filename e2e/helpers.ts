import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com service_role só pra limpar estado entre testes (rascunho de
 * campanha) — nunca usado pra ações que o próprio app faria.
 */
export function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function clearWizardDraft(): Promise<void> {
  await serviceClient().from("campaign_drafts").delete().not("id", "is", null);
}

/**
 * Credenciais de um usuário já existente no Supabase do projeto — não há
 * ambiente de staging separado, então os testes rodam contra o mesmo banco
 * usado em produção. Por isso os specs de wizard param antes de publicar
 * de verdade (ver campaign-*.spec.ts): evita poluir dados reais a cada run.
 */
export function requireTestCredentials(): { email: string; password: string } {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Defina E2E_EMAIL e E2E_PASSWORD (ex.: no .env.local) com um usuário existente do LunaAds antes de rodar os testes e2e.",
    );
  }
  return { email, password };
}

export async function login(page: Page): Promise<void> {
  const { email, password } = requireTestCredentials();
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
}
