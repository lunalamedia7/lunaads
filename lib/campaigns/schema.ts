import { z } from "zod";

/**
 * PRECISA CONFIRMAR NA DOC oficial da Marketing API antes da Fase 7 publicar
 * de verdade: os códigos exatos aceitos em `objective`, `optimization_goal`,
 * `bid_type` e `call_to_action` podem variar por tipo de objetivo/conta.
 * Os valores abaixo refletem o conjunto mais estável e documentado.
 */
export const CAMPAIGN_OBJECTIVES = [
  { value: "CONVERSIONS", label: "Conversões" },
  { value: "TRAFFIC", label: "Tráfego" },
  { value: "LEAD_GENERATION", label: "Geração de leads" },
  { value: "REACH", label: "Alcance" },
  { value: "VIDEO_VIEWS", label: "Visualizações de vídeo" },
  { value: "PRODUCT_SALES", label: "Vendas de produto (TikTok Shop)" },
] as const;

export const CTA_OPTIONS = [
  { value: "SHOP_NOW", label: "Comprar agora" },
  { value: "LEARN_MORE", label: "Saiba mais" },
  { value: "SIGN_UP", label: "Cadastre-se" },
  { value: "DOWNLOAD_NOW", label: "Baixar agora" },
  { value: "CONTACT_US", label: "Fale conosco" },
] as const;

const objectiveValues = CAMPAIGN_OBJECTIVES.map((o) => o.value) as [string, ...string[]];
const ctaValues = CTA_OPTIONS.map((o) => o.value) as [string, ...string[]];

export const step1Schema = z.object({
  accountIds: z.array(z.string()).default([]).pipe(z.array(z.string()).min(1, "Selecione pelo menos uma conta.")),
  templateId: z.string().nullable().optional(),
});

export const step2Schema = z.object({
  objective: z.enum(objectiveValues, { message: "Selecione o objetivo da campanha." }),
  namePattern: z
    .string()
    .trim()
    .min(3, "Informe um padrão de nome.")
    .default("CA_{timestamp}_{index}_{random}"),
  budgetType: z.enum(["CBO", "ABO"]).default("ABO"),
  budgetMode: z.enum(["DAILY", "LIFETIME"]).default("DAILY"),
  budgetAmount: z.coerce.number().positive("Informe um orçamento válido."),
});

export const step3Schema = z
  .object({
    optimizationGoal: z.string().trim().min(1, "Selecione o objetivo de otimização."),
    conversionEvent: z.string().trim().optional().default(""),
    pixelId: z.string().trim().optional().default(""),
    placementMode: z.enum(["AUTOMATIC", "MANUAL"]).default("AUTOMATIC"),
    countries: z.array(z.string()).min(1, "Selecione ao menos um país."),
    languages: z.array(z.string()).optional().default([]),
    ageMin: z.coerce.number().min(13).max(65),
    ageMax: z.coerce.number().min(13).max(65),
    genders: z.array(z.enum(["MALE", "FEMALE", "ALL"])).min(1, "Selecione ao menos um gênero."),
    budgetAmount: z.coerce.number().positive("Informe um orçamento válido."),
    budgetMode: z.enum(["DAILY", "LIFETIME"]).default("DAILY"),
    bidType: z.enum(["LOWEST_COST", "COST_CAP", "BID_CAP"]).default("LOWEST_COST"),
    bidAmount: z.coerce.number().optional(),
    startDate: z.string().min(1, "Informe a data de início."),
    endDate: z.string().optional().default(""),
    deliveryType: z.enum(["STANDARD", "ACCELERATED"]).default("STANDARD"),
  })
  .refine((data) => data.ageMax >= data.ageMin, {
    message: "Idade máxima precisa ser maior ou igual à mínima.",
    path: ["ageMax"],
  });

export const step4Schema = z.object({
  creativeSource: z.enum(["UPLOAD", "LIBRARY", "SPARK"]).default("LIBRARY"),
  creativeRef: z.string().trim().min(1, "Selecione ou informe o criativo."),
  adText: z.string().trim().min(1, "Escreva o texto do anúncio.").max(300),
  cta: z.enum(ctaValues, { message: "Selecione uma chamada para ação." }),
  destinationUrl: z.string().trim().url("Informe uma URL válida (com https://)."),
  identityRef: z.string().trim().optional().default(""),
});

export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type Step4Data = z.infer<typeof step4Schema>;

/** Nó de anúncio dentro de um conjunto, usado pelo Estilo Builder. */
export type BuilderAdNode = {
  id: string;
  data: Partial<Step4Data>;
};

/** Nó de conjunto de anúncios, usado pelo Estilo Builder (N conjuntos, M anúncios cada). */
export type BuilderAdGroupNode = {
  id: string;
  data: Partial<Step3Data>;
  ads: BuilderAdNode[];
};

export type WizardData = {
  step1?: Partial<Step1Data>;
  step2?: Partial<Step2Data>;
  step3?: Partial<Step3Data>;
  step4?: Partial<Step4Data>;
  /** Presente quando montado pelo Estilo Builder — substitui step3/step4. */
  adGroups?: BuilderAdGroupNode[];
};

export const STEP_SCHEMAS = [step1Schema, step2Schema, step3Schema, step4Schema] as const;

/**
 * Normaliza o Fast (step3/step4 únicos) e o Builder (adGroups[]) pro MESMO
 * formato de saída — é isso que garante que o motor de publicação (Fase 7)
 * tem um único caminho de código, não importa qual assistente foi usado.
 */
export type NormalizedAdGroup = { config: Step3Data; ads: Step4Data[] };

export function normalizeAdGroups(wizardData: WizardData): NormalizedAdGroup[] {
  if (wizardData.adGroups && wizardData.adGroups.length > 0) {
    return wizardData.adGroups.map((group) => ({
      config: step3Schema.parse(group.data),
      ads: group.ads.map((ad) => step4Schema.parse(ad.data)),
    }));
  }
  return [
    {
      config: step3Schema.parse(wizardData.step3 ?? {}),
      ads: [step4Schema.parse(wizardData.step4 ?? {})],
    },
  ];
}

/**
 * Estimativa de custo diário somado (todas as contas). CBO: o orçamento é da
 * campanha (step2), então cada conta gasta 1x esse valor não importa quantos
 * conjuntos existam. ABO: cada conjunto tem seu próprio orçamento, soma-se.
 * Tolerante a árvore incompleta (nós ainda sendo editados no Builder) — nesse
 * caso retorna null em vez de lançar, pra a UI mostrar "—" em vez de quebrar.
 */
export function estimateDailyCost(wizardData: WizardData, accountCount: number): number | null {
  const step2 = wizardData.step2;
  // Espelha os defaults de step2Schema — o valor exibido na UI antes de
  // qualquer clique já é "ABO"/"DAILY", então a prévia de custo precisa
  // considerar o mesmo default, não só o que já foi de fato clicado.
  const budgetType = step2?.budgetType ?? "ABO";
  if (budgetType === "CBO") {
    const budgetMode = step2?.budgetMode ?? "DAILY";
    if (!step2?.budgetAmount || budgetMode !== "DAILY") return null;
    return step2.budgetAmount * accountCount;
  }
  try {
    const groups = normalizeAdGroups(wizardData);
    const perCampaign = groups.reduce((sum, g) => sum + (g.config.budgetMode === "DAILY" ? g.config.budgetAmount : 0), 0);
    return perCampaign * accountCount;
  } catch {
    return null;
  }
}

export function countCampaignsSummary(wizardData: WizardData, accountCount: number) {
  const groups = wizardData.adGroups && wizardData.adGroups.length > 0
    ? wizardData.adGroups
    : [{ id: "single", data: wizardData.step3 ?? {}, ads: [{ id: "single", data: wizardData.step4 ?? {} }] }];
  const adGroupCount = groups.length;
  const adCount = groups.reduce((sum, g) => sum + g.ads.length, 0);
  return {
    campaigns: accountCount,
    adGroupsPerCampaign: adGroupCount,
    adsTotal: adCount,
    totalAdGroups: adGroupCount * accountCount,
    totalAds: adCount * accountCount,
  };
}

/** Só para uso no servidor, na hora real de publicar (lib/campaigns/publish.ts). */
export function generateCampaignName(pattern: string, index: number): string {
  const random = Math.random().toString(36).slice(2, 8);
  return pattern
    .replaceAll("{timestamp}", Date.now().toString())
    .replaceAll("{index}", String(index + 1))
    .replaceAll("{random}", random);
}

/**
 * Versão determinística para pré-visualização na UI — nunca chama
 * Date.now()/Math.random() durante o render (evita mismatch de hidratação).
 */
export function previewCampaignName(pattern: string, index: number): string {
  return pattern
    .replaceAll("{timestamp}", "1700000000000")
    .replaceAll("{index}", String(index + 1))
    .replaceAll("{random}", "a1b2c3");
}
