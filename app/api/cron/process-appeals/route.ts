import { NextResponse } from "next/server";
import { processDueAutoAppeals } from "@/lib/appeals/process";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const result = await processDueAutoAppeals();
  return NextResponse.json({ ok: true, ...result });
}
