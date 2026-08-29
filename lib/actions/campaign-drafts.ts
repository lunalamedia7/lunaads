"use server";

import { getCurrentOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import type { WizardData } from "@/lib/campaigns/schema";

export async function saveDraft(step: number, data: WizardData) {
  const org = await getCurrentOrg();
  if (!org) return { error: "Sessão inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const { error } = await supabase.from("campaign_drafts").upsert(
    {
      org_id: org.id,
      user_id: user.id,
      current_step: step,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,user_id" },
  );

  if (error) return { error: "Não foi possível salvar o rascunho." };
  return { error: null };
}

export async function clearDraft() {
  const org = await getCurrentOrg();
  if (!org) return { error: "Sessão inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  await supabase.from("campaign_drafts").delete().eq("org_id", org.id).eq("user_id", user.id);
  return { error: null };
}
