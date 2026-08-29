"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { encrypt } from "@/lib/crypto";
import { reprocessWebhookEvent } from "@/lib/checkout/process";
import { CHECKOUT_PLATFORMS } from "@/lib/checkout";

export type CheckoutActionState = { error: string | null; success: string | null };

const createSchema = z.object({
  platform: z.enum(CHECKOUT_PLATFORMS as [string, ...string[]]),
  secret: z.string().trim().optional(),
  fieldMap: z.string().trim().optional(),
});

export async function createCheckoutIntegration(
  _prevState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const org = await requireRole("admin");

  const parsed = createSchema.safeParse({
    platform: formData.get("platform"),
    secret: formData.get("secret") || undefined,
    fieldMap: formData.get("fieldMap") || undefined,
  });

  if (!parsed.success) {
    return { error: "Dados inválidos.", success: null };
  }

  let fieldMap: Record<string, unknown> = {};
  if (parsed.data.platform === "generic" && parsed.data.fieldMap) {
    try {
      fieldMap = JSON.parse(parsed.data.fieldMap);
    } catch {
      return { error: "O mapeamento de campos precisa ser um JSON válido.", success: null };
    }
  }

  // checkout_integrations guarda secret_enc e não tem policy de RLS para o
  // client autenticado (mesmo tratamento de tiktok_connections) — só o
  // service_role escreve aqui, com org_id sempre filtrado manualmente.
  const serviceDb = createServiceClient();
  const { error } = await serviceDb.from("checkout_integrations").insert({
    org_id: org.id,
    platform: parsed.data.platform,
    secret_enc: parsed.data.secret ? encrypt(parsed.data.secret) : null,
    field_map: fieldMap,
  });

  if (error) {
    return { error: "Não foi possível criar a integração.", success: null };
  }

  const supabase = await createClient();
  await supabase.from("audit_log").insert({
    org_id: org.id,
    action: "checkout_integration.created",
    entity: "checkout_integration",
    payload: { platform: parsed.data.platform },
  });

  revalidatePath("/integracoes");
  return { error: null, success: "Integração criada." };
}

export async function toggleCheckoutIntegration(id: string, isActive: boolean): Promise<CheckoutActionState> {
  const org = await requireRole("admin");
  const serviceDb = createServiceClient();
  const { error } = await serviceDb
    .from("checkout_integrations")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", org.id);

  if (error) return { error: "Não foi possível atualizar.", success: null };
  revalidatePath("/integracoes");
  return { error: null, success: isActive ? "Integração ativada." : "Integração pausada." };
}

export async function deleteCheckoutIntegration(id: string): Promise<CheckoutActionState> {
  const org = await requireRole("admin");
  const serviceDb = createServiceClient();
  const { error } = await serviceDb
    .from("checkout_integrations")
    .delete()
    .eq("id", id)
    .eq("org_id", org.id);

  if (error) return { error: "Não foi possível remover.", success: null };
  revalidatePath("/integracoes");
  return { error: null, success: "Integração removida." };
}

export async function reprocessEvent(eventId: string): Promise<CheckoutActionState> {
  const org = await requireRole("operator");
  const result = await reprocessWebhookEvent(eventId, org.id);
  revalidatePath("/integracoes");
  if (result.error) return { error: result.error, success: null };
  return { error: null, success: "Evento reprocessado." };
}

export async function getWebhookUrlForIntegration(platform: string, token: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${origin}/api/webhooks/${platform}/${token}`;
}
