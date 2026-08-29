import "server-only";
import type { CheckoutAdapter } from "@/lib/checkout/types";
import { hotmartAdapter } from "@/lib/checkout/adapters/hotmart";
import { kiwifyAdapter } from "@/lib/checkout/adapters/kiwify";
import { genericAdapter } from "@/lib/checkout/adapters/generic";

const ADAPTERS: Record<string, CheckoutAdapter> = {
  hotmart: hotmartAdapter,
  kiwify: kiwifyAdapter,
  generic: genericAdapter,
};

export function getCheckoutAdapter(platform: string): CheckoutAdapter | null {
  return ADAPTERS[platform] ?? null;
}

export const CHECKOUT_PLATFORMS = Object.keys(ADAPTERS);
