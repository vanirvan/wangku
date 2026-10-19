import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth-schema";

export const aiSettings = pgTable(
  "ai_settings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    provider: text("provider", {
      enum: ["openai", "custom", "google", "groq", "openrouter"],
    })
      .default("openai")
      .notNull(),
    model: text("model").notNull(),
    baseUrl: text("base_url"),
    encryptedApiKey: text("encrypted_api_key"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("ai_settings_userId_idx").on(table.userId)],
);

export type AISettings = typeof aiSettings.$inferSelect;
export type NewAISettings = typeof aiSettings.$inferInsert;
