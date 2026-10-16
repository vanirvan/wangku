import type { PaymentMethod } from "@/lib/db/schemas";

import { getPaymentMethods } from "./actions";

let paymentMethodsCache: PaymentMethod[] | null = null;
let inFlightPaymentMethods: Promise<PaymentMethod[]> | null = null;

export function getCachedPaymentMethodsSync(): PaymentMethod[] | null {
  return paymentMethodsCache;
}

export function setCachedPaymentMethods(methods: PaymentMethod[]) {
  paymentMethodsCache = methods;
}

export async function fetchPaymentMethodsWithCache(
  forceRefresh = false,
): Promise<PaymentMethod[]> {
  if (!forceRefresh && paymentMethodsCache) {
    return paymentMethodsCache;
  }
  if (!forceRefresh && inFlightPaymentMethods) {
    return inFlightPaymentMethods;
  }
  inFlightPaymentMethods = getPaymentMethods()
    .then((res) => {
      const list = res.data ?? [];
      paymentMethodsCache = list;
      return list;
    })
    .finally(() => {
      inFlightPaymentMethods = null;
    });
  return inFlightPaymentMethods;
}

export function invalidatePaymentMethodsCache() {
  paymentMethodsCache = null;
}
