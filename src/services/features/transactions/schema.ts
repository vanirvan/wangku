import { z } from "zod";

export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    title: z
      .string()
      .trim()
      .max(100, "Title cannot exceed 100 characters")
      .optional()
      .or(z.literal("")),
    paymentMethodId: z.string().min(1, "Payment method is required"),
    toPaymentMethodId: z.string().optional().nullable(),
    category: z
      .string()
      .trim()
      .max(50, "Category cannot exceed 50 characters")
      .optional()
      .or(z.literal("")),
    description: z.string().trim().max(255).optional(),
    date: z.coerce.date().default(() => new Date()),
  })
  .superRefine((data, ctx) => {
    if (data.type === "transfer") {
      if (!data.toPaymentMethodId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Destination wallet is required for transfer",
          path: ["toPaymentMethodId"],
        });
      } else if (data.toPaymentMethodId === data.paymentMethodId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Source and destination wallets must be different",
          path: ["toPaymentMethodId"],
        });
      }
    } else {
      if (!data.title || data.title.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Title or purpose is required",
          path: ["title"],
        });
      }
      if (!data.category || data.category.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Category is required",
          path: ["category"],
        });
      }
    }
  });

export type TransactionFormValues = z.infer<typeof transactionSchema>;
export type TransactionInput = z.input<typeof transactionSchema>;
