import { z } from "zod";
import type { CanonicalSale, CheckoutAdapter, CheckoutAdapterContext, SaleStatus } from "@/lib/checkout/types";

/**
 * Adapter para o Hotmart. Baseado no formato público mais comum dos
 * webhooks (Postback v2) — CONFIRME NA DOC do Hotmart antes de operar com
 * volume real: nomes de campo e o cabeçalho exato do "Hottok" podem variar
 * por versão/tipo de produto (assinatura vs. compra única).
 * https://developers.hotmart.com/docs/en/webhooks/
 */

const hotmartPayloadSchema = z.object({
  event: z.string(),
  data: z.object({
    purchase: z.object({
      transaction: z.string(),
      status: z.string(),
      price: z.object({
        value: z.number(),
        currency_value: z.string().optional().default("BRL"),
      }),
      payment: z
        .object({ type: z.string().optional() })
        .optional()
        .default({}),
      order_date: z.number().optional(),
      approved_date: z.number().optional(),
    }),
    buyer: z
      .object({ email: z.string().optional(), name: z.string().optional() })
      .optional()
      .default({}),
    product: z.object({ name: z.string().optional() }).optional().default({}),
    subscription: z
      .object({
        offer: z.object({ code: z.string().optional() }).optional(),
      })
      .optional(),
  }),
});

function mapStatus(rawStatus: string): SaleStatus {
  const status = rawStatus.toUpperCase();
  if (["APPROVED", "COMPLETE", "COMPLETED"].includes(status)) return "paid";
  if (["REFUNDED"].includes(status)) return "refunded";
  if (["CHARGEBACK"].includes(status)) return "chargeback";
  if (["BILLET_PRINTED", "PIX_GENERATED", "WAITING_PAYMENT", "PRINTED_BILLET"].includes(status)) {
    return "pending";
  }
  return "initiated";
}

function mapPaymentMethod(rawType: string | undefined): CanonicalSale["paymentMethod"] {
  const type = (rawType ?? "").toUpperCase();
  if (type.includes("PIX")) return "pix";
  if (type.includes("BILLET") || type.includes("BOLETO")) return "boleto";
  if (type.includes("CARD")) return "card";
  return null;
}

function firstName(fullName: string | undefined): string | null {
  if (!fullName) return null;
  return fullName.trim().split(/\s+/)[0] || null;
}

export const hotmartAdapter: CheckoutAdapter = {
  platform: "hotmart",

  verifySignature(ctx: CheckoutAdapterContext): boolean {
    if (!ctx.secret) return true;
    const hottok = ctx.headers.get("x-hotmart-hottok") ?? ctx.headers.get("hottok");
    return hottok === ctx.secret;
  },

  parse(ctx: CheckoutAdapterContext): CanonicalSale | null {
    const json = JSON.parse(ctx.rawBody);
    const result = hotmartPayloadSchema.safeParse(json);
    if (!result.success) return null;

    const { purchase, buyer, product } = result.data.data;
    const occurredAt = purchase.order_date ? new Date(purchase.order_date) : new Date();
    const status = mapStatus(purchase.status);

    return {
      externalId: purchase.transaction,
      status,
      grossAmount: purchase.price.value,
      netAmount: purchase.price.value,
      currency: purchase.price.currency_value,
      paymentMethod: mapPaymentMethod(purchase.payment.type),
      occurredAt,
      paidAt: status === "paid" && purchase.approved_date ? new Date(purchase.approved_date) : null,
      buyerEmail: buyer.email ?? null,
      buyerFirstName: firstName(buyer.name),
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      productName: product.name ?? null,
    };
  },

  dedupeKey(sale) {
    return `hotmart:${sale.externalId}:${sale.status}`;
  },
};
