import "server-only";
import { MockProvider } from "@/lib/tiktok/mock-provider";
import { HttpProvider } from "@/lib/tiktok/http-provider";
import type { TikTokProvider } from "@/lib/tiktok/types";

export type { TikTokProvider } from "@/lib/tiktok/types";
export { TikTokApiError } from "@/lib/tiktok/types";
export type {
  TikTokBusinessCenter,
  TikTokAdAccount,
  TikTokTokenSet,
  TikTokCurrency,
} from "@/lib/tiktok/types";

let cached: TikTokProvider | null = null;

export function getTikTokProvider(): TikTokProvider {
  if (cached) return cached;

  const mode = process.env.TIKTOK_PROVIDER ?? "mock";

  if (mode === "http") {
    const appId = process.env.TIKTOK_APP_ID;
    const appSecret = process.env.TIKTOK_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error(
        "TIKTOK_PROVIDER=http requer TIKTOK_APP_ID e TIKTOK_APP_SECRET configurados.",
      );
    }
    cached = new HttpProvider(appId, appSecret);
    return cached;
  }

  cached = new MockProvider();
  return cached;
}

export function tiktokOAuthAuthorizeUrl(state: string): string {
  const appId = process.env.TIKTOK_APP_ID;
  const redirectUri = process.env.TIKTOK_OAUTH_REDIRECT_URI;
  if (!appId || !redirectUri) {
    throw new Error("TIKTOK_APP_ID e TIKTOK_OAUTH_REDIRECT_URI precisam estar configurados.");
  }
  const url = new URL("https://business-api.tiktok.com/portal/auth");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}
