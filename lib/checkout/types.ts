export type SaleStatus = "initiated" | "pending" | "paid" | "refunded" | "chargeback";
export type PaymentMethod = "pix" | "card" | "boleto";

export type CanonicalSale = {
  externalId: string;
  status: SaleStatus;
  grossAmount: number;
  netAmount: number;
  currency: string;
  paymentMethod: PaymentMethod | null;
  occurredAt: Date;
  paidAt: Date | null;
  buyerEmail: string | null;
  buyerFirstName: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  productName: string | null;
};

export type CheckoutAdapterContext = {
  headers: Headers;
  query: URLSearchParams;
  rawBody: string;
  secret: string | null;
  fieldMap: Record<string, unknown>;
};

export interface CheckoutAdapter {
  platform: string;
  /** true = assinatura válida (ou plataforma sem verificação de assinatura). */
  verifySignature(ctx: CheckoutAdapterContext): boolean;
  /** null = payload não reconhecido/malformado — registrar erro, responder 200. */
  parse(ctx: CheckoutAdapterContext): CanonicalSale | null;
  /** Chave de deduplicação; default razoável: platform+externalId+status. */
  dedupeKey(sale: CanonicalSale): string;
}
