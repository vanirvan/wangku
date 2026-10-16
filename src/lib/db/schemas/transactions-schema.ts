import { index, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth-schema";
import { paymentMethods } from "./payment-methods-schema";

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    paymentMethodId: text("payment_method_id")
      .notNull()
      .references(() => paymentMethods.id, { onDelete: "cascade" }),
    toPaymentMethodId: text("to_payment_method_id").references(
      () => paymentMethods.id,
      { onDelete: "set null" },
    ),
    type: text("type", { enum: ["income", "expense", "transfer"] }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    title: text("title"),
    category: text("category").notNull(),
    description: text("description"),
    date: timestamp("date").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("transactions_userId_idx").on(table.userId),
    index("transactions_date_idx").on(table.date),
    index("transactions_paymentMethodId_idx").on(table.paymentMethodId),
    index("transactions_toPaymentMethodId_idx").on(table.toPaymentMethodId),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
