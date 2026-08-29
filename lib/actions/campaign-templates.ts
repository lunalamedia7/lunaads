"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import type { WizardData } from "@/lib/campaigns/schema";

export type TemplateActionState = { error: string | null; success: string | null };

const nameSchema = z.string().trim().min(2, "Informe um nome para o template.").max(80);

export async function createTemplate(
  _prevState: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const org = await requireRole("operator");
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nome inválido.", success: null };

  const configRaw = formData.get("config");
  let config: WizardData = {};
  if (typeof configRaw === "string" && configRaw) {
    try {
      config = JSON.parse(configRaw);
    } catch {
      return { error: "Configuração inválida.", success: null };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("campaign_templates").insert({
    org_id: org.id,
    name: parsed.data,
    config,
    created_by: user?.id ?? null,
  });

  if (error) return { error: "Não foi possível criar o template.", success: null };

  revalidatePath("/templates");
  revalidatePath("/campanhas/nova");
  return { error: null, success: "Template criado." };
}

export async function duplicateTemplate(id: string): Promise<TemplateActionState> {
  const org = await requireRole("operator");
  const supabase = await createClient();

  const { data: original, error: fetchError } = await supabase
    .from("campaign_templates")
    .select("name, config")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();

  if (fetchError || !original) return { error: "Template não encontrado.", success: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("campaign_templates").insert({
    org_id: org.id,
    name: `${original.name} (cópia)`,
    config: original.config,
    created_by: user?.id ?? null,
  });

  if (error) return { error: "Não foi possível duplicar.", success: null };
  revalidatePath("/templates");
  return { error: null, success: "Template duplicado." };
}

export async function toggleFavoriteTemplate(id: string, isFavorite: boolean): Promise<TemplateActionState> {
  const org = await requireRole("operator");
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaign_templates")
    .update({ is_favorite: isFavorite, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", org.id);

  if (error) return { error: "Não foi possível atualizar.", success: null };
  revalidatePath("/templates");
  return { error: null, success: null };
}

export async function deleteTemplate(id: string): Promise<TemplateActionState> {
  const org = await requireRole("operator");
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaign_templates")
    .delete()
    .eq("id", id)
    .eq("org_id", org.id);

  if (error) return { error: "Não foi possível remover.", success: null };
  revalidatePath("/templates");
  return { error: null, success: "Template removido." };
}
