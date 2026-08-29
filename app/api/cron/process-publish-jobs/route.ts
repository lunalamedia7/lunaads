import { NextResponse } from "next/server";
import { processDuePublishJobs } from "@/lib/campaigns/publish";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sem secret configurado em dev local
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await processDuePublishJobs();
  return NextResponse.json({ ok: true, ...result });
}
