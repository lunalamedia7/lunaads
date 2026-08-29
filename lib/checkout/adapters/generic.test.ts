import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { genericAdapter } from "./generic";

const fieldMap = {
  externalIdPath: "order.id",
  statusPath: "order.status",
  statusMap: { paid: "paid", pending: "pending" },
  grossAmountPath: "order.total",
  buyerEmailPath: "customer.email",
  buyerNamePath: "customer.name",
  signatureHeader: "x-webhook-signature",
  signatureMode: "hmac-sha256" as const,
};

function makeCtx(body: string, signature?: string) {
  const headers = new Headers();
  if (signature) headers.set("x-webhook-signature", signature);
  return {
    headers,
    query: new URLSearchParams(),
    rawBody: body,
    secret: "shark-secret",
    fieldMap,
  };
}

describe("generic adapter — HMAC-SHA256", () => {
  const body = JSON.stringify({
    order: { id: "ORDER1", status: "paid", total: 47.9 },
    customer: { email: "a@b.com", name: "Ana Silva" },
  });

  it("aceita assinatura HMAC-SHA256 correta", () => {
    const validSig = createHmac("sha256", "shark-secret").update(body).digest("hex");
    expect(genericAdapter.verifySignature(makeCtx(body, validSig))).toBe(true);
  });

  it("aceita assinatura no formato sha256=<hex>", () => {
    const validSig = createHmac("sha256", "shark-secret").update(body).digest("hex");
    expect(genericAdapter.verifySignature(makeCtx(body, `sha256=${validSig}`))).toBe(true);
  });

  it("rejeita assinatura incorreta", () => {
    expect(genericAdapter.verifySignature(makeCtx(body, "abc123"))).toBe(false);
  });

  it("rejeita quando não há header de assinatura", () => {
    expect(genericAdapter.verifySignature(makeCtx(body))).toBe(false);
  });

  it("parseia o payload mapeado corretamente", () => {
    const sale = genericAdapter.parse(makeCtx(body));
    expect(sale?.externalId).toBe("ORDER1");
    expect(sale?.status).toBe("paid");
    expect(sale?.grossAmount).toBe(47.9);
    expect(sale?.buyerFirstName).toBe("Ana");
  });
});
