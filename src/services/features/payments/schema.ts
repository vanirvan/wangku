import { z } from "zod";

import { paymentMethodTypes } from "./data";

export const paymentMethodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(50, "Name must be at most 50 characters"),
  type: z.enum(paymentMethodTypes),
  currency: z.string().trim().min(1).default("IDR"),
  balance: z.coerce.number().min(0, "Balance cannot be negative").default(0),
});

export type PaymentMethodFormValues = z.infer<typeof paymentMethodSchema>;
export type PaymentMethodInput = z.input<typeof paymentMethodSchema>;
