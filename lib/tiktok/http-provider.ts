import { z } from "zod";
import { tiktokRequest } from "@/lib/tiktok/http-client";
import type {
  AdReviewStatus,
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

/**
 * Implementação real da Marketing API do TikTok.
 *
 * Endpoints usados aqui estão confirmados no SDK oficial (Bloco C):
 *   GET  /bc/get/, /bc/balance/get/, /bc/asset/get/
 *   GET  /advertiser/info/, /advertiser/balance/get/
 *
 * O que NÃO está confirmado e precisa de verificação na doc oficial antes
 * de qualquer conexão real (não há como testar sem um app TikTok for
 * Developers aprovado — este provider nunca rodou contra a API de verdade):
 *   - Contrato exato de troca de auth_code por token (assumido aqui como
 *     POST /oauth2/access_token/ com {app_id, secret, auth_code}, que é o
 *     padrão estável da Marketing API, mas os nomes de campo podem variar
 *     por versão — CONFIRME antes de ativar TIKTOK_PROVIDER=http).
 *   - Nomes exatos de campo em cada resposta (bc_id/name/company_name/etc.)
 *     — mapeados abaixo com Zod a partir dos nomes mais comuns do SDK
 *     oficial; ajuste os `.transform`/chaves se a resposta real divergir.
 */

const CURRENCY_VALUES = ["BRL", "USD", "CLP"] as const;

function coerceCurrency(value: string): TikTokCurrency {
  return (CURRENCY_VALUES as readonly string[]).includes(value)
    ? (value as TikTokCurrency)
    : "USD";
}

const bcSchema = z.object({
  bc_id: z.string(),
  bc_name: z.string(),
  company_name: z.string().optional().default(""),
  currency: z.string().optional().default("USD"),
  status: z.string().optional().default("STATUS_ENABLE"),
});

const bcListSchema = z.object({
  list: z.array(bcSchema).optional().default([]),
});

const bcBalanceSchema = z.object({
  bc_id: z.string(),
  balance: z.number().optional(),
  can_read_finance: z.boolean().optional().default(true),
});

const advertiserSchema = z.object({
  advertiser_id: z.string(),
  advertiser_name: z.string(),
  currency: z.string().optional().default("USD"),
  timezone: z.string().optional().default("UTC"),
  status: z.string().optional().default("STATUS_ENABLE"),
});

const bcAssetSchema = z.object({
  advertiser_list: z.array(advertiserSchema).optional().default([]),
});

const advertiserBalanceSchema = z.object({
  advertiser_id: z.string(),
  balance: z.number().optional(),
});

const tokenExchangeSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  scope: z.array(z.string()).optional().default([]),
  advertiser_ids: z.array(z.string()).optional().default([]),
  expires_in: z.number().optional().default(86400),
});

function mapStatus(status: string): "active" | "suspended" | "pending" {
  const normalized = status.toUpperCase();
  if (normalized.includes("DISABLE") || normalized.includes("SUSPEND")) return "suspended";
  if (normalized.includes("PENDING") || normalized.includes("REVIEW")) return "pending";
  return "active";
}

export class HttpProvider implements TikTokProvider {
  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
  ) {}

  async exchangeCodeForToken(authCode: string): Promise<TikTokTokenSet> {
    const raw = await tiktokRequest("/oauth2/access_token/", {
      method: "POST",
      body: { app_id: this.appId, secret: this.appSecret, auth_code: authCode },
    });
    const data = tokenExchangeSchema.parse(raw);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      scopes: data.scope,
      advertiserIds: data.advertiser_ids,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async refreshToken(refreshToken: string): Promise<TikTokTokenSet> {
    const raw = await tiktokRequest("/oauth2/refresh_token/", {
      method: "POST",
      body: { app_id: this.appId, secret: this.appSecret, refresh_token: refreshToken },
    });
    const data = tokenExchangeSchema.parse(raw);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      scopes: data.scope,
      advertiserIds: data.advertiser_ids,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  async listBusinessCenters(accessToken: string): Promise<TikTokBusinessCenter[]> {
    const raw = await tiktokRequest("/bc/get/", { accessToken });
    const { list } = bcListSchema.parse(raw);

    const results: TikTokBusinessCenter[] = [];
    for (const bc of list) {
      let balance: number | null = null;
      let canReadFinance = true;
      try {
        const balanceRaw = await tiktokRequest("/bc/balance/get/", {
          accessToken,
          query: { bc_id: bc.bc_id },
          bucketKey: bc.bc_id,
        });
        const parsed = bcBalanceSchema.parse(balanceRaw);
        balance = parsed.balance ?? null;
        canReadFinance = parsed.can_read_finance;
      } catch {
        canReadFinance = false;
      }

      results.push({
        bcId: bc.bc_id,
        name: bc.bc_name,
        companyName: bc.company_name,
        currency: coerceCurrency(bc.currency),
        status: mapStatus(bc.status) === "suspended" ? "suspended" : "active",
        canReadFinance,
        balance,
      });
    }
    return results;
  }

  async listAdAccounts(accessToken: string, bcId: string): Promise<TikTokAdAccount[]> {
    const raw = await tiktokRequest("/bc/asset/get/", {
      accessToken,
      query: { bc_id: bcId, asset_type: "ADVERTISER" },
    });
    const { advertiser_list } = bcAssetSchema.parse(raw);

    const results: TikTokAdAccount[] = [];
    for (const advertiser of advertiser_list) {
      let balance: number | null = null;
      let canReadFinance = true;
      try {
        const balanceRaw = await tiktokRequest("/advertiser/balance/get/", {
          accessToken,
          query: { advertiser_id: advertiser.advertiser_id },
          bucketKey: advertiser.advertiser_id,
        });
        balance = advertiserBalanceSchema.parse(balanceRaw).balance ?? null;
      } catch {
        canReadFinance = false;
      }

      results.push({
        advertiserId: advertiser.advertiser_id,
        bcId,
        name: advertiser.advertiser_name,
        currency: coerceCurrency(advertiser.currency),
        timezone: advertiser.timezone,
        status: mapStatus(advertiser.status),
        isLimited: mapStatus(advertiser.status) === "pending",
        canReadFinance,
        balance,
      });
    }
    return results;
  }

  /**
   * PRECISA CONFIRMAR NA DOC antes de publicar de verdade: os paths
   * /campaign/create/, /adgroup/create/, /ad/create/ estão confirmados no
   * SDK oficial (Bloco C), mas o corpo exato de cada request (nomes de
   * campo, formato de segmentação/criativo) varia por objetivo e tipo de
   * conta — o mapeamento abaixo é o formato mais estável e documentado,
   * mas nunca rodou contra a API de verdade.
   */
  async createCampaign(
    accessToken: string,
    input: CreateCampaignInput,
  ): Promise<{ campaignId: string }> {
    const raw = await tiktokRequest("/campaign/create/", {
      method: "POST",
      accessToken,
      bucketKey: input.advertiserId,
      body: {
        advertiser_id: input.advertiserId,
        campaign_name: input.name,
        objective_type: input.objective,
        budget_mode: input.budgetMode === "DAILY" ? "BUDGET_MODE_DAY" : "BUDGET_MODE_TOTAL",
        budget: input.budgetAmount,
      },
    });
    const { campaign_id } = z.object({ campaign_id: z.string() }).parse(raw);
    return { campaignId: campaign_id };
  }

  async createAdGroup(
    accessToken: string,
    input: CreateAdGroupInput,
  ): Promise<{ adgroupId: string }> {
    const raw = await tiktokRequest("/adgroup/create/", {
      method: "POST",
      accessToken,
      bucketKey: input.advertiserId,
      body: {
        advertiser_id: input.advertiserId,
        campaign_id: input.campaignId,
        adgroup_name: input.name,
        optimization_goal: input.optimizationGoal,
        deep_bid_type: input.bidType,
        bid_price: input.bidAmount,
        budget_mode: input.budgetMode === "DAILY" ? "BUDGET_MODE_DAY" : "BUDGET_MODE_TOTAL",
        budget: input.budgetAmount,
        location_ids: input.countries,
        languages: input.languages,
        age_groups: [`${input.ageMin}-${input.ageMax}`],
        gender: input.genders[0] ?? "GENDER_UNLIMITED",
        placement_type: input.placementMode,
        pixel_id: input.pixelId || undefined,
        schedule_start_time: input.startDate,
        schedule_end_time: input.endDate || undefined,
        pacing: input.deliveryType === "ACCELERATED" ? "PACING_MODE_FAST" : "PACING_MODE_SMOOTH",
      },
    });
    const { adgroup_id } = z.object({ adgroup_id: z.string() }).parse(raw);
    return { adgroupId: adgroup_id };
  }

  async createAd(accessToken: string, input: CreateAdInput): Promise<{ adId: string }> {
    const raw = await tiktokRequest("/ad/create/", {
      method: "POST",
      accessToken,
      bucketKey: input.advertiserId,
      body: {
        advertiser_id: input.advertiserId,
        adgroup_id: input.adgroupId,
        ad_name: input.name,
        ad_text: input.adText,
        call_to_action: input.cta,
        landing_page_url: input.destinationUrl,
        identity_id: input.identityRef || undefined,
        creatives: [{ source: input.creativeSource, ref: input.creativeRef }],
      },
    });
    const { ad_id } = z.object({ ad_id: z.string() }).parse(raw);
    return { adId: ad_id };
  }

  async listCampaigns(accessToken: string, advertiserId: string): Promise<TikTokCampaignSummary[]> {
    const raw = await tiktokRequest("/campaign/get/", {
      accessToken,
      bucketKey: advertiserId,
      query: { advertiser_id: advertiserId },
    });
    const { list } = z
      .object({
        list: z
          .array(
            z.object({
              campaign_id: z.string(),
              campaign_name: z.string(),
              objective_type: z.string().optional(),
              operation_status: z.string().optional().default("ENABLE"),
              budget_mode: z.string().optional(),
              budget: z.number().optional(),
            }),
          )
          .optional()
          .default([]),
      })
      .parse(raw);

    return list.map((c) => ({
      campaignId: c.campaign_id,
      name: c.campaign_name,
      objective: c.objective_type ?? null,
      status: mapOperationStatus(c.operation_status),
      budgetMode: c.budget_mode?.includes("TOTAL") ? "LIFETIME" : "DAILY",
      budgetAmount: c.budget ?? null,
    }));
  }

  async listAdGroups(accessToken: string, advertiserId: string): Promise<TikTokAdGroupSummary[]> {
    const raw = await tiktokRequest("/adgroup/get/", {
      accessToken,
      bucketKey: advertiserId,
      query: { advertiser_id: advertiserId },
    });
    const { list } = z
      .object({
        list: z
          .array(
            z.object({
              adgroup_id: z.string(),
              campaign_id: z.string(),
              adgroup_name: z.string(),
              operation_status: z.string().optional().default("ENABLE"),
              budget_mode: z.string().optional(),
              budget: z.number().optional(),
            }),
          )
          .optional()
          .default([]),
      })
      .parse(raw);

    return list.map((a) => ({
      adgroupId: a.adgroup_id,
      campaignId: a.campaign_id,
      name: a.adgroup_name,
      status: mapOperationStatus(a.operation_status),
      budgetMode: a.budget_mode?.includes("TOTAL") ? "LIFETIME" : "DAILY",
      budgetAmount: a.budget ?? null,
    }));
  }

  async listAds(accessToken: string, advertiserId: string): Promise<TikTokAdSummary[]> {
    const raw = await tiktokRequest("/ad/get/", {
      accessToken,
      bucketKey: advertiserId,
      query: { advertiser_id: advertiserId },
    });
    const { list } = z
      .object({
        list: z
          .array(
            z.object({
              ad_id: z.string(),
              adgroup_id: z.string(),
              ad_name: z.string(),
              operation_status: z.string().optional().default("ENABLE"),
            }),
          )
          .optional()
          .default([]),
      })
      .parse(raw);

    return list.map((a) => ({
      adId: a.ad_id,
      adgroupId: a.adgroup_id,
      name: a.ad_name,
      status: mapOperationStatus(a.operation_status),
    }));
  }

  async updateCampaignStatus(
    accessToken: string,
    advertiserId: string,
    campaignIds: string[],
    status: "active" | "paused",
  ): Promise<void> {
    await tiktokRequest("/campaign/status/update/", {
      method: "POST",
      accessToken,
      bucketKey: advertiserId,
      body: {
        advertiser_id: advertiserId,
        campaign_ids: campaignIds,
        operation_status: status === "active" ? "ENABLE" : "DISABLE",
      },
    });
  }

  async updateAdGroupStatus(
    accessToken: string,
    advertiserId: string,
    adgroupIds: string[],
    status: "active" | "paused",
  ): Promise<void> {
    await tiktokRequest("/adgroup/status/update/", {
      method: "POST",
      accessToken,
      bucketKey: advertiserId,
      body: {
        advertiser_id: advertiserId,
        adgroup_ids: adgroupIds,
        operation_status: status === "active" ? "ENABLE" : "DISABLE",
      },
    });
  }

  async updateAdGroupBudget(
    accessToken: string,
    advertiserId: string,
    adgroupId: string,
    budgetAmount: number,
  ): Promise<void> {
    await tiktokRequest("/adgroup/update/", {
      method: "POST",
      accessToken,
      bucketKey: advertiserId,
      body: {
        advertiser_id: advertiserId,
        adgroup_id: adgroupId,
        budget: budgetAmount,
      },
    });
  }

  async getMetrics(): Promise<Record<string, TikTokMetrics>> {
    throw new Error(
      "PRECISA CONFIRMAR NA DOC: /report/integrated/get/ ainda não está confirmado (Bloco C). " +
        "Métricas reais não estão disponíveis com TIKTOK_PROVIDER=http até esse contrato ser verificado.",
    );
  }

  /**
   * Só cobre o fluxo Smart+ (endpoint confirmado). Para os demais tipos de
   * anúncio, a API pública não expõe motivo/reprovação de forma confirmada —
   * retorna `rejected: false` nesses casos em vez de arriscar um falso
   * positivo (ver limitação documentada no Bloco C).
   */
  async checkAdReviewStatus(
    accessToken: string,
    advertiserId: string,
    adIds: string[],
  ): Promise<Record<string, AdReviewStatus>> {
    const result: Record<string, AdReviewStatus> = {};
    for (const adId of adIds) {
      try {
        const raw = await tiktokRequest("/smart_plus/ad/review_info/", {
          accessToken,
          bucketKey: advertiserId,
          query: { advertiser_id: advertiserId, ad_id: adId },
        });
        const parsed = z
          .object({
            status: z.string().optional().default(""),
            reject_reason: z.string().optional().nullable(),
          })
          .parse(raw);
        const rejected = parsed.status.toUpperCase().includes("REJECT");
        result[adId] = {
          rejected,
          rejectReason: rejected ? (parsed.reject_reason ?? "Motivo não informado.") : null,
          isSmartPlus: true,
        };
      } catch {
        // Não é Smart+ (ou não coberto) — não há endpoint confirmado para
        // detectar reprovação nesse caso, então não afirmamos rejeição.
        result[adId] = { rejected: false, rejectReason: null, isSmartPlus: false };
      }
    }
    return result;
  }

  async submitSmartPlusAppeal(
    accessToken: string,
    advertiserId: string,
    adId: string,
    text: string,
  ): Promise<{ tiktokResponse: string }> {
    const raw = await tiktokRequest("/smart_plus/ad/appeal/", {
      method: "POST",
      accessToken,
      bucketKey: advertiserId,
      body: { advertiser_id: advertiserId, ad_id: adId, appeal_text: text },
    });
    const parsed = z.object({ status: z.string().optional().default("SUBMITTED") }).parse(raw);
    return { tiktokResponse: parsed.status };
  }

  async listPixels(accessToken: string, bcId: string): Promise<TikTokPixel[]> {
    const raw = await tiktokRequest("/bc/pixel/link/get/", {
      accessToken,
      bucketKey: bcId,
      query: { bc_id: bcId },
    });
    const { list } = z
      .object({
        list: z
          .array(z.object({ pixel_id: z.string(), pixel_name: z.string().optional().default("") }))
          .optional()
          .default([]),
      })
      .parse(raw);
    return list.map((p) => ({ pixelId: p.pixel_id, name: p.pixel_name || p.pixel_id }));
  }

  /**
   * PRECISA CONFIRMAR NA DOC: a Events API (CAPI) do TikTok está listada
   * como "a confirmar" no Bloco C. Não há como saber o path exato, o
   * formato do corpo (schema `data[]`?) nem o algoritmo de hash esperado
   * sem consultar a documentação oficial primeiro.
   */
  async sendPurchaseEvent(): Promise<{ response: string }> {
    throw new Error(
      "PRECISA CONFIRMAR NA DOC: Events API (CAPI) do TikTok ainda não está confirmada (Bloco C). " +
        "Envio de Purchase server-side não está disponível com TIKTOK_PROVIDER=http até esse contrato ser verificado.",
    );
  }
}

function mapOperationStatus(status: string): "active" | "paused" | "other" {
  const normalized = status.toUpperCase();
  if (normalized.includes("DISABLE") || normalized.includes("PAUSE")) return "paused";
  if (normalized.includes("ENABLE") || normalized.includes("DELIVERY_OK")) return "active";
  return "other";
}
