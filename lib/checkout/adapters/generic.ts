import { createHmac, timingSafeEqual } from "node:crypto";
import type { CanonicalSale, CheckoutAdapter, CheckoutAdapterContext, SaleStatus } from "@/lib/checkout/types";

/**
 * Adapter genérico: o operador mapeia os campos do payload da própria
 * plataforma de checkout via JSON, sem precisar esperar um adapter
 * dedicado. Formato esperado em `field_map`:
 *
 * {
 *   "externalIdPath": "order.id",
 *   "statusPath": "order.status",
 *   "statusMap": { "paid": "paid", "pending_payment": "pending" },
 *   "grossAmountPath": "order.total",
 *   "netAmountPath": "order.net",
 *   "currency": "BRL",
 *   "paymentMethodPath": "order.payment_method",
 *   "paymentMethodMap": { "pix": "pix", "boleto": "boleto", "cc": "card" },
 *   "occurredAtPath": "order.created_at",
 *   "paidAtPath": "order.paid_at",
 *   "buyerEmailPath": "customer.email",
 *   "buyerNamePath": "customer.name",
 *   "productNamePath": "product.name",
 *   "utmSourcePath": "tracking.utm_source",
 *   "utmMediumPath": "tracking.utm_medium",
 *   "utmCampaignPath": "tracking.utm_campaign",
 *   "utmContentPath": "tracking.utm_content",
 *   "utmTermPath": "tracking.utm_term",
 *   "signatureHeader": "x-webhook-signature",
 *   "signatureMode": "hmac-sha256"   // "hmac-sha256" (padrão da Shark) | "hmac-sha1" | "exact"
 * }
 */

type GenericFieldMap = {
  externalIdPath?: string;
  statusPath?: string;
  statusMap?: Record<string, string>;
  grossAmountPath?: string;
  netAmountPath?: string;
  currency?: string;
  paymentMethodPath?: string;
  paymentMethodMap?: Record<string, string>;
  occurredAtPath?: string;
  paidAtPath?: string;
  buyerEmailPath?: string;
  buyerNamePath?: string;
  productNamePath?: string;
  utmSourcePath?: string;
  utmMediumPath?: string;
  utmCampaignPath?: string;
  utmContentPath?: string;
  utmTermPath?: string;
  signatureHeader?: string;
  signatureMode?: "exact" | "hmac-sha256" | "hmac-sha1";
};

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function getByPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const VALID_STATUSES: SaleStatus[] = ["initiated", "pending", "paid", "refunded", "chargeback"];

function firstName(fullName: string | null): string | null {
  if (!fullName) return null;
  return fullName.trim().split(/\s+/)[0] || null;
}

export const genericAdapter: CheckoutAdapter = {
  platform: "generic",

  verifySignature(ctx: CheckoutAdapterContext): boolean {
    if (!ctx.secret) return true;
    const map = ctx.fieldMap as GenericFieldMap;
    const headerName = map.signatureHeader ?? "x-webhook-signature";
    const received = ctx.headers.get(headerName);
    if (!received) return false;

    const mode = map.signatureMode ?? "exact";
    if (mode === "exact") {
      return safeEqual(received, ctx.secret);
    }

    const algorithm = mode === "hmac-sha1" ? "sha1" : "sha256";
    const expected = createHmac(algorithm, ctx.secret).update(ctx.rawBody).digest("hex");
    // Algumas plataformas mandam a assinatura como "sha256=<hex>".
    const normalizedReceived = received.includes("=") ? received.split("=").pop()! : received;
    return safeEqual(normalizedReceived, expected);
  },

  parse(ctx: CheckoutAdapterContext): CanonicalSale | null {
    const map = ctx.fieldMap as GenericFieldMap;
    if (!map.externalIdPath || !map.statusPath) return null;

    const json = JSON.parse(ctx.rawBody);
    const externalId = asString(getByPath(json, map.externalIdPath));
    if (!externalId) return null;

    const rawStatus = asString(getByPath(json, map.statusPath)) ?? "";
    const mappedStatus = map.statusMap?.[rawStatus] ?? rawStatus;
    const status: SaleStatus = VALID_STATUSES.includes(mappedStatus as SaleStatus)
      ? (mappedStatus as SaleStatus)
      : "initiated";

    const rawPayment = asString(getByPath(json, map.paymentMethodPath)) ?? "";
    const mappedPayment = map.paymentMethodMap?.[rawPayment] ?? null;
    const paymentMethod: CanonicalSale["paymentMethod"] =
      mappedPayment === "pix" || mappedPayment === "boleto" || mappedPayment === "card"
        ? mappedPayment
        : null;

    const occurredAtRaw = getByPath(json, map.occurredAtPath);
    const paidAtRaw = getByPath(json, map.paidAtPath);
    const buyerName = asString(getByPath(json, map.buyerNamePath));

    return {
      externalId,
      status,
      grossAmount: asNumber(getByPath(json, map.grossAmountPath)),
      netAmount: asNumber(getByPath(json, map.netAmountPath) ?? getByPath(json, map.grossAmountPath)),
      currency: map.currency ?? "BRL",
      paymentMethod,
      occurredAt: occurredAtRaw ? new Date(occurredAtRaw as string | number) : new Date(),
      paidAt: status === "paid" && paidAtRaw ? new Date(paidAtRaw as string | number) : null,
      buyerEmail: asString(getByPath(json, map.buyerEmailPath)),
      buyerFirstName: firstName(buyerName),
      utmSource: asString(getByPath(json, map.utmSourcePath)),
      utmMedium: asString(getByPath(json, map.utmMediumPath)),
      utmCampaign: asString(getByPath(json, map.utmCampaignPath)),
      utmContent: asString(getByPath(json, map.utmContentPath)),
      utmTerm: asString(getByPath(json, map.utmTermPath)),
      productName: asString(getByPath(json, map.productNamePath)),
    };
  },

  dedupeKey(sale) {
    return `generic:${sale.externalId}:${sale.status}`;
  },
};
