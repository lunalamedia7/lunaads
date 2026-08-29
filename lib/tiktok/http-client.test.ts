import { describe, it, expect, vi, afterEach } from "vitest";
import { tiktokRequest } from "./http-client";
import { TikTokApiError } from "./types";

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    json: async () => body,
  } as Response;
}

describe("lib/tiktok/http-client retry", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it(
    "tenta de novo em erro de rede e devolve o dado assim que a chamada funciona",
    async () => {
      let calls = 0;
      global.fetch = vi.fn(async () => {
        calls += 1;
        if (calls < 3) throw new Error("network down");
        return jsonResponse({ code: 0, message: "OK", request_id: "req-1", data: { ok: true } });
      }) as unknown as typeof fetch;

      const result = await tiktokRequest("/bc/get/", {
        accessToken: "token",
        bucketKey: "test-retry-network",
      });

      expect(calls).toBe(3);
      expect(result).toEqual({ ok: true });
    },
    15_000,
  );

  it("não tenta de novo em erro de validação (não retryable)", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ code: 40001, message: "invalid parameter", request_id: "req-2" }, 400),
    ) as unknown as typeof fetch;

    await expect(
      tiktokRequest("/bc/get/", { accessToken: "token", bucketKey: "test-non-retryable" }),
    ).rejects.toBeInstanceOf(TikTokApiError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it(
    "desiste depois do número máximo de tentativas em erro persistente",
    async () => {
      global.fetch = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;

      const err = await tiktokRequest("/bc/get/", {
        accessToken: "token",
        bucketKey: "test-max-attempts",
      }).catch((e) => e);

      expect(err).toBeInstanceOf(TikTokApiError);
      expect(global.fetch).toHaveBeenCalledTimes(5);
    },
    30_000,
  );
});
