"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export type BcActionState = { error: string | null; success: string | null };

const aliasSchema = z.string().trim().max(80).optional();

export async function renameBusinessCenterAlias(
  bcRowId: string,
  formData: FormData,
): Promise<BcActionState> {
  const org = await requireRole("admin");
  const parsed = aliasSchema.safeParse(formData.get("alias") || undefined);
  if (!parsed.success) {
    return { error: "Nome inválido.", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("business_centers")
    .update({ alias: parsed.data || null, updated_at: new Date().toISOString() })
    .eq("id", bcRowId)
    .eq("org_id", org.id);

  if (error) {
    return { error: "Não foi possível renomear.", success: null };
  }

  await supabase.from("audit_log").insert({
    org_id: org.id,
    action: "business_center.renamed",
    entity: "business_center",
    entity_id: bcRowId,
    payload: { alias: parsed.data ?? null },
  });

  revalidatePath("/business-centers");
  return { error: null, success: "Nome atualizado." };
}

export async function disconnectBusinessCenter(bcRowId: string): Promise<BcActionState> {
  const org = await requireRole("admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("business_centers")
    .delete()
    .eq("id", bcRowId)
    .eq("org_id", org.id);

  if (error) {
    return { error: "Não foi possível desconectar este Business Center.", success: null };
  }

  await supabase.from("audit_log").insert({
    org_id: org.id,
    action: "business_center.disconnected",
    entity: "business_center",
    entity_id: bcRowId,
    payload: {},
  });

  revalidatePath("/business-centers");
  revalidatePath("/contas");
  return { error: null, success: "Business Center desconectado." };
}
