import { index, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth-schema";

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type", { enum: ["cash", "bank", "ewallet", "card", "other"] })
      .default("cash")
      .notNull(),
    balance: numeric("balance", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("payment_methods_userId_idx").on(table.userId)],
);

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
