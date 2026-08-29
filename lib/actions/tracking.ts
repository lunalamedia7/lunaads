"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { syncPixels } from "@/lib/tracking/pixel-sync";

export type TrackingActionState = { error: string | null; success: string | null };

export async function syncPixelsNow(): Promise<TrackingActionState> {
  const org = await requireRole("operator");
  try {
    const result = await syncPixels(org.id);
    revalidatePath("/pixel");
    return { error: null, success: `${result.count} pixel(s) sincronizado(s).` };
  } catch {
    return { error: "Falha ao sincronizar. Verifique a conexão com o TikTok Ads.", success: null };
  }
}

export async function updateAttributionSettings(
  _prevState: TrackingActionState,
  formData: FormData,
): Promise<TrackingActionState> {
  const org = await requireRole("admin");
  const windowHours = Number(formData.get("windowHours"));
  const model = formData.get("model") as string;

  if (!Number.isFinite(windowHours) || windowHours <= 0) {
    return { error: "Janela de atribuição inválida.", success: null };
  }
  if (model !== "last_click" && model !== "first_click") {
    return { error: "Modelo inválido.", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("attribution_settings").upsert(
    { org_id: org.id, window_hours: windowHours, model, updated_at: new Date().toISOString() },
    { onConflict: "org_id" },
  );

  if (error) return { error: "Não foi possível salvar.", success: null };
  revalidatePath("/tracking");
  return { error: null, success: "Configuração de atribuição salva." };
}
