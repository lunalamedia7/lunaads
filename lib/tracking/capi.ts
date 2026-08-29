import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessToken } from "@/lib/tiktok/connection";
import { getTikTokProvider } from "@/lib/tiktok";

/**
 * Gera (ou reaproveita) o event_id de uma venda e envia o Purchase pro
 * TikTok via CAPI. O MESMO event_id deve ser passado pro pixel do TikTok
 * instalado no site do operador (ex.: `ttq.track('Purchase', {...},
 * {event_id: eventId})`) — é isso que evita contar a venda em dobro.
 *
 * Em TIKTOK_PROVIDER=http isso lança erro (Events API não confirmada no
 * Bloco C) — a venda continua registrada normalmente, só o envio pro
 * TikTok não acontece até o contrato ser verificado.
 */
export async function sendPurchaseEventForSale(orgId: string, saleId: string): Promise<{ error: string | null }> {
  const db = createServiceClient();

  const { data: sale } = await db
    .from("sales")
    .select("id, event_id, gross_amount, currency, buyer_hash, utm_term, occurred_at")
    .eq("id", saleId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!sale) return { error: "Venda não encontrada." };

  const eventId = sale.event_id ?? randomUUID();
  if (!sale.event_id) {
    await db.from("sales").update({ event_id: eventId }).eq("id", saleId);
  }

  const { data: pixel } = await db
    .from("pixels")
    .select("tiktok_pixel_id")
    .eq("org_id", orgId)
    .limit(1)
    .maybeSingle();

  if (!pixel) {
    return { error: "Nenhum pixel sincronizado para enviar o evento." };
  }

  try {
    const accessToken = await getAccessToken(orgId);
    const provider = getTikTokProvider();
    const result = await provider.sendPurchaseEvent(accessToken, pixel.tiktok_pixel_id, {
      eventId,
      eventTimeSeconds: Math.floor(new Date(sale.occurred_at).getTime() / 1000),
      value: Number(sale.gross_amount),
      currency: sale.currency,
      // e-mail já vem hasheado (buyer_hash) — nunca sai PII crua do servidor.
      emailHash: sale.buyer_hash
        ? sale.buyer_hash
        : null,
      ttclid: null,
      sourceUrl: null,
    });

    await db
      .from("sales")
      .update({ capi_sent_at: new Date().toISOString(), capi_response: result.response })
      .eq("id", saleId);

    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    await db.from("sales").update({ capi_response: message }).eq("id", saleId);
    return { error: message };
  }
}

export function hashForCapi(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}
