export type TikTokCurrency = "BRL" | "USD" | "CLP";

export type TikTokBusinessCenter = {
  bcId: string;
  name: string;
  companyName: string;
  currency: TikTokCurrency;
  status: "active" | "suspended";
  canReadFinance: boolean;
  balance: number | null;
};

export type TikTokAdAccount = {
  advertiserId: string;
  bcId: string;
  name: string;
  currency: TikTokCurrency;
  timezone: string;
  status: "active" | "suspended" | "pending";
  isLimited: boolean;
  canReadFinance: boolean;
  balance: number | null;
};

export type TikTokTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date;
  advertiserIds: string[];
};

export type TikTokApiOk<T> = { ok: true; data: T; requestId: string };
export type TikTokApiErr = { ok: false; error: TikTokApiError };
export type TikTokApiResult<T> = TikTokApiOk<T> | TikTokApiErr;

export class TikTokApiError extends Error {
  code: number;
  requestId: string;
  retryable: boolean;

  constructor(params: { code: number; message: string; requestId: string; retryable?: boolean }) {
    super(params.message);
    this.name = "TikTokApiError";
    this.code = params.code;
    this.requestId = params.requestId;
    this.retryable = params.retryable ?? false;
  }
}

export type CreateCampaignInput = {
  advertiserId: string;
  name: string;
  objective: string;
  budgetMode: "DAILY" | "LIFETIME";
  budgetAmount: number;
};

export type CreateAdGroupInput = {
  advertiserId: string;
  campaignId: string;
  name: string;
  optimizationGoal: string;
  conversionEvent?: string;
  pixelId?: string;
  placementMode: "AUTOMATIC" | "MANUAL";
  countries: string[];
  languages?: string[];
  ageMin: number;
  ageMax: number;
  genders: string[];
  budgetMode: "DAILY" | "LIFETIME";
  budgetAmount: number;
  bidType: string;
  bidAmount?: number;
  startDate: string;
  endDate?: string;
  deliveryType: "STANDARD" | "ACCELERATED";
};

export type CreateAdInput = {
  advertiserId: string;
  adgroupId: string;
  name: string;
  creativeSource: "UPLOAD" | "LIBRARY" | "SPARK";
  creativeRef: string;
  adText: string;
  cta: string;
  destinationUrl: string;
  identityRef?: string;
};

export type TikTokCampaignSummary = {
  campaignId: string;
  name: string;
  objective: string | null;
  status: "active" | "paused" | "other";
  budgetMode: "DAILY" | "LIFETIME" | null;
  budgetAmount: number | null;
};

export type TikTokAdGroupSummary = {
  adgroupId: string;
  campaignId: string;
  name: string;
  status: "active" | "paused" | "other";
  budgetMode: "DAILY" | "LIFETIME" | null;
  budgetAmount: number | null;
};

export type TikTokAdSummary = {
  adId: string;
  adgroupId: string;
  name: string;
  status: "active" | "paused" | "other";
};

export type TikTokMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

export type TikTokPixel = {
  pixelId: string;
  name: string;
};

export type CapiPurchaseEvent = {
  eventId: string;
  eventTimeSeconds: number;
  value: number;
  currency: string;
  emailHash: string | null;
  ttclid: string | null;
  sourceUrl: string | null;
};

export type AdReviewStatus = {
  rejected: boolean;
  rejectReason: string | null;
  isSmartPlus: boolean;
};

export interface TikTokProvider {
  /** Troca um auth_code do fluxo OAuth por um access_token. */
  exchangeCodeForToken(authCode: string): Promise<TikTokTokenSet>;
  /** Renova um access_token perto de expirar. */
  refreshToken(refreshToken: string): Promise<TikTokTokenSet>;
  /** Lista os Business Centers visíveis para o token conectado. */
  listBusinessCenters(accessToken: string): Promise<TikTokBusinessCenter[]>;
  /** Lista as contas de anúncio (advertisers) de um Business Center. */
  listAdAccounts(accessToken: string, bcId: string): Promise<TikTokAdAccount[]>;
  /** POST /campaign/create/ */
  createCampaign(accessToken: string, input: CreateCampaignInput): Promise<{ campaignId: string }>;
  /** POST /adgroup/create/ */
  createAdGroup(accessToken: string, input: CreateAdGroupInput): Promise<{ adgroupId: string }>;
  /** POST /ad/create/ */
  createAd(accessToken: string, input: CreateAdInput): Promise<{ adId: string }>;
  /** GET /campaign/get/ */
  listCampaigns(accessToken: string, advertiserId: string): Promise<TikTokCampaignSummary[]>;
  /** GET /adgroup/get/ */
  listAdGroups(accessToken: string, advertiserId: string): Promise<TikTokAdGroupSummary[]>;
  /** GET /ad/get/ */
  listAds(accessToken: string, advertiserId: string): Promise<TikTokAdSummary[]>;
  /** POST /campaign/status/update/ */
  updateCampaignStatus(accessToken: string, advertiserId: string, campaignIds: string[], status: "active" | "paused"): Promise<void>;
  /** POST /adgroup/status/update/ */
  updateAdGroupStatus(accessToken: string, advertiserId: string, adgroupIds: string[], status: "active" | "paused"): Promise<void>;
  /** POST /adgroup/update/ (orçamento) */
  updateAdGroupBudget(accessToken: string, advertiserId: string, adgroupId: string, budgetAmount: number): Promise<void>;
  /**
   * Métricas de desempenho. PRECISA CONFIRMAR NA DOC: /report/integrated/get/
   * está listado como "a confirmar" no Bloco C — não implementado no
   * HttpProvider por esse motivo. Funciona só em modo mock por enquanto.
   */
  getMetrics(accessToken: string, advertiserId: string, entityIds: string[]): Promise<Record<string, TikTokMetrics>>;
  /**
   * Status de revisão. PRECISA CONFIRMAR NA DOC: campos exatos de reprovação
   * em /ad/get/ para anúncios fora do Smart+. Para Smart+, usa o endpoint
   * confirmado /smart_plus/ad/review_info/.
   */
  checkAdReviewStatus(
    accessToken: string,
    advertiserId: string,
    adIds: string[],
  ): Promise<Record<string, AdReviewStatus>>;
  /**
   * POST /smart_plus/ad/appeal/ — só cobre o fluxo Smart+ (Bloco C). Para os
   * demais tipos de anúncio não existe apelação via API pública; o
   * AssistedAppealStrategy cobre esse caso sem chamar este método.
   */
  submitSmartPlusAppeal(
    accessToken: string,
    advertiserId: string,
    adId: string,
    text: string,
  ): Promise<{ tiktokResponse: string }>;
  /** GET /bc/pixel/link/get/ */
  listPixels(accessToken: string, bcId: string): Promise<TikTokPixel[]>;
  /**
   * Events API (CAPI) server-side. PRECISA CONFIRMAR NA DOC: está na lista
   * "a confirmar" do Bloco C — endpoint, payload e formato de hash não
   * verificados contra a doc oficial.
   */
  sendPurchaseEvent(
    accessToken: string,
    pixelId: string,
    event: CapiPurchaseEvent,
  ): Promise<{ response: string }>;
}
