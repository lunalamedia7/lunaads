import { getCurrentOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { TemplatesList, type TemplateRow } from "@/components/templates/templates-list";

export default async function TemplatesPage() {
  const org = await getCurrentOrg();
  const supabase = await createClient();

  const { data: templates } = org
    ? await supabase
        .from("campaign_templates")
        .select("id, name, is_favorite, updated_at")
        .eq("org_id", org.id)
        .order("updated_at", { ascending: false })
    : { data: null };

  const rows: TemplateRow[] = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    isFavorite: t.is_favorite,
    updatedAt: t.updated_at,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Templates</h1>
        <p className="mt-1 text-sm text-text-muted">Monte uma vez, reutilize em todas as publicações.</p>
      </div>
      <TemplatesList templates={rows} />
    </div>
  );
}
