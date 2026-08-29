import { randomUUID } from "node:crypto";
import type {
  AdReviewStatus,
  CapiPurchaseEvent,
  CreateAdGroupInput,
  CreateAdInput,
  CreateCampaignInput,
  TikTokAdAccount,
  TikTokAdGroupSummary,
  TikTokAdSummary,
  TikTokBusinessCenter,
  TikTokCampaignSummary,
  TikTokCurrency,
  TikTokMetrics,
  TikTokPixel,
  TikTokProvider,
  TikTokTokenSet,
} from "@/lib/tiktok/types";

const REJECT_REASONS = [
  "Alegação de saúde não comprovada no criativo.",
  "Uso de elementos gráficos considerados chocantes.",
  "Landing page não corresponde ao anúncio.",
  "Texto do anúncio viola política de antes/depois.",
  "Áudio com direitos autorais não licenciado.",
];

const BC_COUNT = 5;
const ADVERTISERS_PER_BC = 10;

const BC_CURRENCIES: TikTokCurrency[] = ["BRL", "BRL", "BRL", "USD", "CLP"];
const BC_COMPANIES = [
  "Aurora Digital Ltda",
  "Nortelab Performance",
  "Vega Growth Media",
  "Cascade Ads LLC",
  "Andes Media SpA",
];

function buildBusinessCenters(): TikTokBusinessCenter[] {
  return Array.from({ length: BC_COUNT }, (_, i) => {
    const index = i + 1;
    const currency = BC_CURRENCIES[i];
    return {
      bcId: `bc_mock_${String(index).padStart(3, "0")}`,
      name: `Business Center ${index}`,
      companyName: BC_COMPANIES[i],
      currency,
      status: "active",
      canReadFinance: true,
      balance: currency === "BRL" ? 12_500.5 * index : currency === "USD" ? 3_200.75 * index : 890_000 * index,
    };
  });
}

function buildAdAccounts(bcId: string, bcIndex: number, currency: TikTokCurrency): TikTokAdAccount[] {
  return Array.from({ length: ADVERTISERS_PER_BC }, (_, i) => {
    const accountIndex = i + 1;
    const globalIndex = bcIndex * ADVERTISERS_PER_BC + accountIndex;
    const isNoFinancePermission = bcIndex === 0 && accountIndex === 1;
    const isLimited = bcIndex === 1 && accountIndex === 3;

    return {
      advertiserId: `adv_mock_${String(globalIndex).padStart(4, "0")}`,
      bcId,
      name: `Conta ${globalIndex} — BC${bcIndex + 1}`,
      currency,
      timezone: "America/Sao_Paulo",
      status: isLimited ? "pending" : "active",
      isLimited,
      canReadFinance: !isNoFinancePermission,
      balance: isNoFinancePermission
        ? null
        : currency === "BRL"
          ? 850.25 * accountIndex
          : currency === "USD"
            ? 210.4 * accountIndex
            : 65_000 * accountIndex,
    };
  });
}

export class MockProvider implements TikTokProvider {
  async exchangeCodeForToken(authCode: string): Promise<TikTokTokenSet> {
    return {
      accessToken: `mock_access_token_${authCode}`,
      refreshToken: `mock_refresh_token_${authCode}`,
      scopes: ["bc.read", "advertiser.read"],
      advertiserIds: [],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async refreshToken(refreshToken: string): Promise<TikTokTokenSet> {
    return {
      accessToken: `mock_access_token_refreshed`,
      refreshToken,
      scopes: ["bc.read", "advertiser.read"],
      advertiserIds: [],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async listBusinessCenters(): Promise<TikTokBusinessCenter[]> {
    return buildBusinessCenters();
  }

  async listAdAccounts(_accessToken: string, bcId: string): Promise<TikTokAdAccount[]> {
    const bcs = buildBusinessCenters();
    const bcIndex = bcs.findIndex((bc) => bc.bcId === bcId);
    if (bcIndex === -1) return [];
    return buildAdAccounts(bcId, bcIndex, bcs[bcIndex].currency);
  }

  async createCampaign(
    _accessToken: string,
    input: CreateCampaignInput,
  ): Promise<{ campaignId: string }> {
    await simulateLatency();
    return { campaignId: `mock_campaign_${input.advertiserId}_${randomUUID().slice(0, 8)}` };
  }

  async createAdGroup(
    _accessToken: string,
    input: CreateAdGroupInput,
  ): Promise<{ adgroupId: string }> {
    await simulateLatency();
    return { adgroupId: `mock_adgroup_${input.campaignId}_${randomUUID().slice(0, 8)}` };
  }

  async createAd(_accessToken: string, input: CreateAdInput): Promise<{ adId: string }> {
    await simulateLatency();
    return { adId: `mock_ad_${input.adgroupId}_${randomUUID().slice(0, 8)}` };
  }

  /**
   * Mock não tem um "backend" externo persistente — os objetos que existem
   * são exatamente os que o próprio LunaAds criou (já gravados nas nossas
   * tabelas no momento da criação). Por isso não há nada a "descobrir" aqui.
   */
  async listCampaigns(): Promise<TikTokCampaignSummary[]> {
    return [];
  }

  async listAdGroups(): Promise<TikTokAdGroupSummary[]> {
    return [];
  }

  async listAds(): Promise<TikTokAdSummary[]> {
    return [];
  }

  async updateCampaignStatus(): Promise<void> {
    await simulateLatency();
  }

  async updateAdGroupStatus(): Promise<void> {
    await simulateLatency();
  }

  async updateAdGroupBudget(): Promise<void> {
    await simulateLatency();
  }

  async getMetrics(
    _accessToken: string,
    _advertiserId: string,
    entityIds: string[],
  ): Promise<Record<string, TikTokMetrics>> {
    await simulateLatency();
    const result: Record<string, TikTokMetrics> = {};
    for (const id of entityIds) {
      const seed = hashSeed(id);
      const impressions = 5_000 + (seed % 45_000);
      const ctr = 0.008 + (seed % 30) / 1000;
      const clicks = Math.round(impressions * ctr);
      const conversions = Math.round(clicks * (0.02 + (seed % 10) / 200));
      const spend = Number((impressions * (0.02 + (seed % 20) / 500)).toFixed(2));
      result[id] = { spend, impressions, clicks, conversions };
    }
    return result;
  }

  async checkAdReviewStatus(
    _accessToken: string,
    _advertiserId: string,
    adIds: string[],
  ): Promise<Record<string, AdReviewStatus>> {
    await simulateLatency();
    const result: Record<string, AdReviewStatus> = {};
    for (const id of adIds) {
      const seed = hashSeed(id);
      const rejected = seed % 100 < 18;
      result[id] = {
        rejected,
        rejectReason: rejected ? REJECT_REASONS[seed % REJECT_REASONS.length] : null,
        isSmartPlus: seed % 2 === 0,
      };
    }
    return result;
  }

  async submitSmartPlusAppeal(
    _accessToken: string,
    _advertiserId: string,
    adId: string,
  ): Promise<{ tiktokResponse: string }> {
    await simulateLatency();
    const seed = hashSeed(adId);
    const approved = seed % 100 < 70;
    return {
      tiktokResponse: approved
        ? "APPEAL_RECEIVED: em análise"
        : "APPEAL_REJECTED: motivo original mantido",
    };
  }

  async listPixels(_accessToken: string, bcId: string): Promise<TikTokPixel[]> {
    await simulateLatency();
    return [
      { pixelId: `pixel_mock_${bcId}_1`, name: "Pixel principal" },
      { pixelId: `pixel_mock_${bcId}_2`, name: "Pixel checkout" },
    ];
  }

  async sendPurchaseEvent(
    _accessToken: string,
    pixelId: string,
    event: CapiPurchaseEvent,
  ): Promise<{ response: string }> {
    await simulateLatency();
    return { response: `EVENTS_RECEIVED: pixel=${pixelId} event_id=${event.eventId}` };
  }
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function simulateLatency() {
  return new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 250));
}
