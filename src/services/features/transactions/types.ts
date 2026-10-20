import type { PaymentMethod, Transaction } from "@/lib/db/schemas";

export type TransactionWithPaymentMethod = Transaction & {
  paymentMethod?: Pick<PaymentMethod, "id" | "name" | "type"> | null;
  toPaymentMethod?: Pick<PaymentMethod, "id" | "name" | "type"> | null;
};

export interface GetTransactionsFilter {
  type?: "income" | "expense" | "transfer";
  paymentMethodId?: string;
  category?: string;
  search?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  limit?: number;
}
