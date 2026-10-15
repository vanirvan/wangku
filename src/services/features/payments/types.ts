import type { paymentMethodTypes } from "./data";

export type PaymentMethodType = (typeof paymentMethodTypes)[number];
