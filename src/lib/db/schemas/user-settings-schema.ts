import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth-schema";

export const userSettings = pgTable(
  "user_settings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    baseCurrency: text("base_currency").default("IDR").notNull(),
    locale: text("locale").default("id-ID").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("user_settings_userId_idx").on(table.userId)],
);

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
