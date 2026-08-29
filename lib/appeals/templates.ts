export type AppealCategory =
  | "health_claim"
  | "shocking_content"
  | "landing_page_mismatch"
  | "before_after"
  | "copyright"
  | "generic";

type CategoryRule = { category: AppealCategory; keywords: string[] };

const CATEGORY_RULES: CategoryRule[] = [
  { category: "health_claim", keywords: ["saúde", "alegação", "médic"] },
  { category: "shocking_content", keywords: ["chocante", "gráfic", "sensível"] },
  { category: "landing_page_mismatch", keywords: ["landing page", "página de destino", "não corresponde"] },
  { category: "before_after", keywords: ["antes/depois", "antes e depois"] },
  { category: "copyright", keywords: ["direitos autorais", "áudio", "licenciad"] },
];

export function categorizeRejectReason(reason: string | null): AppealCategory {
  if (!reason) return "generic";
  const normalized = reason.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => normalized.includes(k))) return rule.category;
  }
  return "generic";
}

const TEMPLATES: Record<AppealCategory, string[]> = {
  health_claim: [
    "Revisamos o criativo do anúncio {ad_name} e ajustamos as alegações de saúde para refletir apenas benefícios comprovados, sem promessas de cura ou resultado garantido. Solicitamos nova avaliação.",
    "O anúncio {ad_name} foi atualizado para remover qualquer alegação de saúde não comprovada, mantendo apenas informações factuais sobre o produto. Pedimos a reanálise.",
  ],
  shocking_content: [
    "O criativo do anúncio {ad_name} foi revisado para remover elementos visuais que possam ser interpretados como chocantes, mantendo uma comunicação adequada às diretrizes da plataforma.",
    "Ajustamos o anúncio {ad_name} para adequar as imagens/cenas às políticas de conteúdo gráfico do TikTok. Solicitamos nova revisão.",
  ],
  landing_page_mismatch: [
    "A página de destino do anúncio {ad_name} foi corrigida para refletir exatamente a oferta apresentada no criativo, eliminando qualquer divergência.",
    "Atualizamos a landing page vinculada ao anúncio {ad_name} para garantir consistência total com o conteúdo anunciado.",
  ],
  before_after: [
    "O anúncio {ad_name} foi editado para não utilizar comparações de antes/depois, em conformidade com a política da plataforma.",
    "Removemos as cenas de comparação antes/depois do criativo {ad_name} e o texto foi ajustado para focar em benefícios gerais do produto.",
  ],
  copyright: [
    "Substituímos a trilha sonora do anúncio {ad_name} por uma faixa licenciada, eliminando o uso de áudio protegido por direitos autorais.",
    "O áudio do anúncio {ad_name} foi trocado por conteúdo de nossa biblioteca própria, sem restrições de direitos autorais.",
  ],
  generic: [
    "Revisamos o anúncio {ad_name} à luz do motivo informado ({reject_reason}) e realizamos os ajustes necessários para adequação às políticas do TikTok. Solicitamos nova avaliação.",
    "O criativo do anúncio {ad_name} foi corrigido conforme o feedback recebido ({reject_reason}). Agradecemos a reanálise.",
  ],
};

/**
 * Escolhe uma variação por rotação determinística (baseada no id do
 * anúncio), evitando repetir sempre a mesma frase em massa.
 */
export function buildAppealText(adId: string, adName: string, rejectReason: string | null): string {
  const category = categorizeRejectReason(rejectReason);
  const variations = TEMPLATES[category];
  const index = hashString(adId) % variations.length;
  return variations[index]
    .replaceAll("{ad_name}", adName)
    .replaceAll("{reject_reason}", rejectReason ?? "não especificado");
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
