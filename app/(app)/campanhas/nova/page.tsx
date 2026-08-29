import { getCurrentOrg } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { CampaignWizard, type TemplateOption } from "@/components/campaigns/campaign-wizard";
import type { AccountOption } from "@/components/campaigns/wizard/step1-accounts";
import type { WizardData } from "@/lib/campaigns/schema";
import { EmptyState } from "@/components/empty-state";
import { Rocket } from "lucide-react";

export default async function NovaCampanhaPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template: templateIdParam } = await searchParams;
  const org = await getCurrentOrg();

  if (!org) {
    return <EmptyState icon={Rocket} title="Não foi possível carregar sua organização" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: accountsRaw }, { data: templatesRaw }, { data: draftRaw }] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select(
        "id, name, advertiser_id, business_center_id, is_limited, can_read_finance, balance, business_centers(name, alias)",
      )
      .eq("org_id", org.id)
      .order("advertiser_id"),
    supabase
      .from("campaign_templates")
      .select("id, name, config")
      .eq("org_id", org.id)
      .order("is_favorite", { ascending: false }),
    user
      ? supabase
          .from("campaign_drafts")
          .select("current_step, data")
          .eq("org_id", org.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const accounts: AccountOption[] = (accountsRaw ?? []).map((account) => {
    const bc = Array.isArray(account.business_centers) ? account.business_centers[0] : account.business_centers;
    return {
      id: account.id,
      name: account.name,
      advertiserId: account.advertiser_id,
      bcId: account.business_center_id,
      bcName: bc?.alias || bc?.name || "—",
      isLimited: account.is_limited,
      canReadFinance: account.can_read_finance,
      balance: account.balance,
    };
  });

  const templates: TemplateOption[] = (templatesRaw ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    config: t.config as WizardData,
  }));

  let initialDraft: { currentStep: number; data: WizardData } | null = draftRaw
    ? { currentStep: draftRaw.current_step, data: draftRaw.data as WizardData }
    : null;

  if (!initialDraft && templateIdParam) {
    const template = templates.find((t) => t.id === templateIdParam);
    if (template) {
      initialDraft = {
        currentStep: 1,
        data: { step1: { templateId: template.id }, ...template.config },
      };
    }
  }

  return (
    <CampaignWizard accounts={accounts} templates={templates} initialDraft={initialDraft} />
  );
}
