import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { decrypt } from "@/lib/crypto";
import { getCheckoutAdapter } from "@/lib/checkout";
import { sendPurchaseEventForSale } from "@/lib/tracking/capi";
import type { CanonicalSale } from "@/lib/checkout/types";

export type ProcessWebhookInput = {
  platform: string;
  token: string;
  headers: Headers;
  query: URLSearchParams;
  rawBody: string;
};

export type ProcessWebhookResult = {
  status: 200 | 401 | 404;
  body: { ok: boolean; reason?: string };
};

function hashBuyer(email: string | null): string | null {
  if (!email) return null;
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export async function processCheckoutWebhook(input: ProcessWebhookInput): Promise<ProcessWebhookResult> {
  const db = createServiceClient();

  const { data: integration } = await db
    .from("checkout_integrations")
    .select("id, org_id, platform, secret_enc, is_active, field_map")
    .eq("webhook_token", input.token)
    .eq("platform", input.platform)
    .maybeSingle();

  if (!integration) {
    return { status: 404, body: { ok: false, reason: "integration_not_found" } };
  }

  if (!integration.is_active) {
    return { status: 200, body: { ok: true, reason: "integration_inactive" } };
  }

  const adapter = getCheckoutAdapter(integration.platform);
  if (!adapter) {
    return { status: 404, body: { ok: false, reason: "unknown_platform" } };
  }

  const secret = integration.secret_enc ? decrypt(integration.secret_enc) : null;
  const ctx = {
    headers: input.headers,
    query: input.query,
    rawBody: input.rawBody,
    secret,
    fieldMap: (integration.field_map as Record<string, unknown>) ?? {},
  };

  const signatureOk = adapter.verifySignature(ctx);

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(input.rawBody);
  } catch {
    rawJson = { raw: input.rawBody };
  }

  if (!signatureOk) {
    await db.from("webhook_events").insert({
      org_id: integration.org_id,
      integration_id: integration.id,
      platform: integration.platform,
      raw: rawJson,
      signature_ok: false,
      dedupe_key: `invalid-signature:${randomUUID()}`,
      error: "invalid_signature",
    });
    return { status: 401, body: { ok: false, reason: "invalid_signature" } };
  }

  let sale: CanonicalSale | null;
  try {
    sale = adapter.parse(ctx);
  } catch {
    sale = null;
  }

  if (!sale) {
    await db.from("webhook_events").insert({
      org_id: integration.org_id,
      integration_id: integration.id,
      platform: integration.platform,
      raw: rawJson,
      signature_ok: true,
      dedupe_key: `malformed:${randomUUID()}`,
      error: "malformed_payload",
    });
    return { status: 200, body: { ok: false, reason: "malformed_payload" } };
  }

  const dedupeKey = adapter.dedupeKey(sale);

  const { error: insertEventError } = await db.from("webhook_events").insert({
    org_id: integration.org_id,
    integration_id: integration.id,
    platform: integration.platform,
    raw: rawJson,
    signature_ok: true,
    dedupe_key: dedupeKey,
  });

  if (insertEventError) {
    // unique(org_id, dedupe_key) violado => evento idêntico já processado.
    return { status: 200, body: { ok: true, reason: "duplicate_ignored" } };
  }

  const { data: savedSale, error: upsertSaleError } = await db
    .from("sales")
    .upsert(
      {
        org_id: integration.org_id,
        platform: integration.platform,
        external_id: sale.externalId,
        status: sale.status,
        gross_amount: sale.grossAmount,
        net_amount: sale.netAmount,
        currency: sale.currency,
        payment_method: sale.paymentMethod,
        occurred_at: sale.occurredAt.toISOString(),
        paid_at: sale.paidAt ? sale.paidAt.toISOString() : null,
        buyer_hash: hashBuyer(sale.buyerEmail),
        buyer_first_name: sale.buyerFirstName,
        utm_source: sale.utmSource,
        utm_medium: sale.utmMedium,
        utm_campaign: sale.utmCampaign,
        utm_content: sale.utmContent,
        utm_term: sale.utmTerm,
        product_name: sale.productName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,platform,external_id" },
    )
    .select("id")
    .single();

  await db
    .from("webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      error: upsertSaleError ? `sale_upsert_failed: ${upsertSaleError.message}` : null,
    })
    .eq("org_id", integration.org_id)
    .eq("dedupe_key", dedupeKey);

  if (upsertSaleError) {
    return { status: 200, body: { ok: false, reason: "sale_upsert_failed" } };
  }

  if (sale.status === "paid" && savedSale) {
    // Best-effort — uma falha aqui (ex.: CAPI não confirmada em modo http)
    // nunca deve derrubar a confirmação do webhook pra plataforma de checkout.
    sendPurchaseEventForSale(integration.org_id, savedSale.id).catch(() => {});
  }

  return { status: 200, body: { ok: true } };
}

export async function reprocessWebhookEvent(eventId: string, orgId: string) {
  const db = createServiceClient();
  const { data: event } = await db
    .from("webhook_events")
    .select("id, org_id, integration_id, raw, platform")
    .eq("id", eventId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!event) return { error: "Evento não encontrado." };

  const { data: integration } = await db
    .from("checkout_integrations")
    .select("id, org_id, platform, secret_enc, field_map")
    .eq("id", event.integration_id)
    .maybeSingle();

  if (!integration) return { error: "Integração não encontrada." };

  const adapter = getCheckoutAdapter(integration.platform);
  if (!adapter) return { error: "Plataforma desconhecida." };

  const rawBody = JSON.stringify(event.raw);
  const secret = integration.secret_enc ? decrypt(integration.secret_enc) : null;

  let sale: CanonicalSale | null;
  try {
    sale = adapter.parse({
      headers: new Headers(),
      query: new URLSearchParams(),
      rawBody,
      secret,
      fieldMap: (integration.field_map as Record<string, unknown>) ?? {},
    });
  } catch {
    sale = null;
  }

  if (!sale) {
    await db.from("webhook_events").update({ error: "malformed_payload" }).eq("id", eventId);
    return { error: "Payload continua malformado." };
  }

  const { data: savedSale, error } = await db
    .from("sales")
    .upsert(
      {
        org_id: orgId,
        platform: integration.platform,
        external_id: sale.externalId,
        status: sale.status,
        gross_amount: sale.grossAmount,
        net_amount: sale.netAmount,
        currency: sale.currency,
        payment_method: sale.paymentMethod,
        occurred_at: sale.occurredAt.toISOString(),
        paid_at: sale.paidAt ? sale.paidAt.toISOString() : null,
        buyer_hash: hashBuyer(sale.buyerEmail),
        buyer_first_name: sale.buyerFirstName,
        utm_source: sale.utmSource,
        utm_medium: sale.utmMedium,
        utm_campaign: sale.utmCampaign,
        utm_content: sale.utmContent,
        utm_term: sale.utmTerm,
        product_name: sale.productName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,platform,external_id" },
    )
    .select("id")
    .single();

  await db
    .from("webhook_events")
    .update({ processed_at: new Date().toISOString(), error: error ? error.message : null })
    .eq("id", eventId);

  if (!error && sale.status === "paid" && savedSale) {
    sendPurchaseEventForSale(orgId, savedSale.id).catch(() => {});
  }

  return error ? { error: "Falha ao reprocessar." } : { error: null };
}
