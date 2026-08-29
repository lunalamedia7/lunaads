import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit } from "@/lib/rate-limit";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const payloadSchema = z.object({
  token: z.string().min(1),
  domain: z.string().min(1),
  sessionId: z.string().min(1),
  eventType: z.enum(["PageView", "ViewContent", "InitiateCheckout", "Purchase"]),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  ttclid: z.string().optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }

  const { allowed } = await checkRateLimit(`collect:${parsed.data.token}`, {
    limit: 600,
    windowSeconds: 60,
  });
  if (!allowed) {
    return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429, headers: CORS_HEADERS });
  }

  const db = createServiceClient();
  const { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", parsed.data.token)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ ok: false }, { status: 200, headers: CORS_HEADERS });
  }

  await db.from("tracking_events").insert({
    org_id: org.id,
    domain: parsed.data.domain,
    event_type: parsed.data.eventType,
    session_id: parsed.data.sessionId,
    ttclid: parsed.data.ttclid ?? null,
    utm_source: parsed.data.utmSource ?? null,
    utm_medium: parsed.data.utmMedium ?? null,
    utm_campaign: parsed.data.utmCampaign ?? null,
    utm_content: parsed.data.utmContent ?? null,
    utm_term: parsed.data.utmTerm ?? null,
  });

  await db.from("tracking_domains").upsert(
    { org_id: org.id, domain: parsed.data.domain, last_seen_at: new Date().toISOString() },
    { onConflict: "org_id,domain" },
  );

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
}
