import { TikTokApiError } from "@/lib/tiktok/types";

const BASE_URL = "https://business-api.tiktok.com/open_api/v1.3";
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 15_000;

type TikTokRawResponse<T> = {
  code: number;
  message: string;
  request_id: string;
  data: T;
};

/**
 * Token bucket simples em memória. Um bucket global de app + um por chave
 * (ex.: advertiser_id) — a fila deve respeitar os dois (Bloco C).
 * Em memória é suficiente para um único processo Node; se o app escalar
 * para múltiplas instâncias, isso precisa virar um bucket compartilhado
 * (ex.: Postgres ou Redis).
 */
class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private lastRefill: number;

  constructor(capacity: number, refillPerSecond: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillPerMs = refillPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefill = now;
  }

  async take(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.max(10, (1 - this.tokens) / this.refillPerMs);
      await sleep(waitMs);
    }
  }
}

const globalBucket = new TokenBucket(10, 5);
const perKeyBuckets = new Map<string, TokenBucket>();

function bucketFor(key: string): TokenBucket {
  let bucket = perKeyBuckets.get(key);
  if (!bucket) {
    bucket = new TokenBucket(5, 2);
    perKeyBuckets.set(key, bucket);
  }
  return bucket;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitteredBackoff(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 16_000);
  return base / 2 + Math.random() * (base / 2);
}

function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) {
  console[level === "info" ? "log" : level](
    JSON.stringify({ scope: "tiktok.http", level, event, ...fields }),
  );
}

export type TikTokRequestOptions = {
  method?: "GET" | "POST";
  accessToken?: string;
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  /** Chave extra de rate limit (ex.: advertiser_id) além do bucket global. */
  bucketKey?: string;
};

export async function tiktokRequest<T>(
  path: string,
  options: TikTokRequestOptions = {},
): Promise<T> {
  const { method = "GET", accessToken, query, body, bucketKey } = options;

  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }

  let lastError: TikTokApiError | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await globalBucket.take();
    if (bucketKey) await bucketFor(bucketKey).take();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { "Access-Token": accessToken } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const json = (await res.json()) as TikTokRawResponse<T>;
      const requestId = json.request_id ?? "unknown";

      if (json.code === 0) {
        log("info", "request_ok", { path, method, requestId, attempt });
        return json.data;
      }

      const retryable = res.status === 429 || res.status >= 500;
      const error = new TikTokApiError({
        code: json.code,
        message: json.message,
        requestId,
        retryable,
      });
      log("warn", "request_api_error", {
        path,
        method,
        requestId,
        code: json.code,
        message: json.message,
        attempt,
        retryable,
      });

      if (!retryable) throw error;
      lastError = error;
    } catch (err) {
      if (err instanceof TikTokApiError) {
        if (!err.retryable) throw err;
        lastError = err;
      } else {
        const isAbort = err instanceof Error && err.name === "AbortError";
        lastError = new TikTokApiError({
          code: -1,
          message: isAbort ? "timeout" : (err as Error).message,
          requestId: "n/a",
          retryable: true,
        });
        log("warn", "request_network_error", {
          path,
          method,
          attempt,
          message: lastError.message,
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(jitteredBackoff(attempt));
    }
  }

  log("error", "request_failed_all_attempts", { path, method, attempts: MAX_ATTEMPTS });
  throw lastError;
}
