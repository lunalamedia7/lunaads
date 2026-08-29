import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { CanonicalSale, CheckoutAdapter, CheckoutAdapterContext, SaleStatus } from "@/lib/checkout/types";

/**
 * Adapter para a Kiwify. Baseado no formato público mais comum dos
 * webhooks — CONFIRME NA DOC da Kiwify antes de operar com volume real:
 * nomes de campo podem variar. A assinatura vem por query string
 * (?signature=...) como HMAC-SHA1 do corpo cru, usando o token configurado
 * no painel da Kiwify como chave.
 * https://docs.kiwify.com.br/
 */

const kiwifyPayloadSchema = z.object({
  order_id: z.string(),
  order_status: z.string(),
  payment_method: z.string().optional(),
  created_at: z.string().optional(),
  approved_date: z.string().nullable().optional(),
  product: z.object({ product_name: z.string().optional() }).optional().default({}),
  Customer: z
    .object({ email: z.string().optional(), full_name: z.string().optional() })
    .optional()
    .default({}),
  Commissions: z
    .object({
      charge_amount: z.number().optional(),
      product_base_price: z.number().optional(),
    })
    .optional()
    .default({}),
  TrackingParameters: z
    .object({
      utm_source: z.string().nullable().optional(),
      utm_medium: z.string().nullable().optional(),
      utm_campaign: z.string().nullable().optional(),
      utm_content: z.string().nullable().optional(),
      utm_term: z.string().nullable().optional(),
    })
    .optional()
    .default({}),
});

function mapStatus(rawStatus: string): SaleStatus {
  const status = rawStatus.toLowerCase();
  if (status === "paid" || status === "approved") return "paid";
  if (status === "refunded") return "refunded";
  if (status === "chargedback" || status === "chargeback") return "chargeback";
  if (status === "waiting_payment" || status === "pending") return "pending";
  return "initiated";
}

function mapPaymentMethod(raw: string | undefined): CanonicalSale["paymentMethod"] {
  const type = (raw ?? "").toLowerCase();
  if (type.includes("pix")) return "pix";
  if (type.includes("billet") || type.includes("boleto")) return "boleto";
  if (type.includes("card")) return "card";
  return null;
}

function firstName(fullName: string | undefined): string | null {
  if (!fullName) return null;
  return fullName.trim().split(/\s+/)[0] || null;
}

export const kiwifyAdapter: CheckoutAdapter = {
  platform: "kiwify",

  verifySignature(ctx: CheckoutAdapterContext): boolean {
    if (!ctx.secret) return true;
    const signature = ctx.query.get("signature");
    if (!signature) return false;
    const expected = createHmac("sha1", ctx.secret).update(ctx.rawBody).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  },

  parse(ctx: CheckoutAdapterContext): CanonicalSale | null {
    const json = JSON.parse(ctx.rawBody);
    const result = kiwifyPayloadSchema.safeParse(json);
    if (!result.success) return null;

    const data = result.data;
    const status = mapStatus(data.order_status);
    const grossAmount = data.Commissions.product_base_price ?? data.Commissions.charge_amount ?? 0;

    return {
      externalId: data.order_id,
      status,
      grossAmount,
      netAmount: data.Commissions.charge_amount ?? grossAmount,
      currency: "BRL",
      paymentMethod: mapPaymentMethod(data.payment_method),
      occurredAt: data.created_at ? new Date(data.created_at) : new Date(),
      paidAt: status === "paid" && data.approved_date ? new Date(data.approved_date) : null,
      buyerEmail: data.Customer.email ?? null,
      buyerFirstName: firstName(data.Customer.full_name),
      utmSource: data.TrackingParameters.utm_source ?? null,
      utmMedium: data.TrackingParameters.utm_medium ?? null,
      utmCampaign: data.TrackingParameters.utm_campaign ?? null,
      utmContent: data.TrackingParameters.utm_content ?? null,
      utmTerm: data.TrackingParameters.utm_term ?? null,
      productName: data.product.product_name ?? null,
    };
  },

  dedupeKey(sale) {
    return `kiwify:${sale.externalId}:${sale.status}`;
  },
};
