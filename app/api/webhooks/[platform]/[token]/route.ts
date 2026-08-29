import { NextResponse } from "next/server";
import { processCheckoutWebhook } from "@/lib/checkout/process";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string; token: string }> },
) {
  const { platform, token } = await params;

  const { allowed } = await checkRateLimit(`webhook:${platform}:${token}`, {
    limit: 120,
    windowSeconds: 60,
  });
  if (!allowed) {
    return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  }

  const rawBody = await request.text();
  const url = new URL(request.url);

  const result = await processCheckoutWebhook({
    platform,
    token,
    headers: request.headers,
    query: url.searchParams,
    rawBody,
  });

  return NextResponse.json(result.body, { status: result.status });
}
