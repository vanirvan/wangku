"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAuthUser } from "@/lib/auth";
import { getCurrencyConfig } from "@/lib/currency";
import { db } from "@/lib/db";
import { type UserSettings, userSettings } from "@/lib/db/schemas";
import { getExchangeRates } from "@/lib/exchange-rates";

export async function getUserSettings(): Promise<{
  data: UserSettings;
  error?: string;
}> {
  const { user, error } = await requireAuthUser();
  if (error || !user) {
    return {
      data: {
        id: "",
        userId: "",
        baseCurrency: "IDR",
        locale: "id-ID",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      error: error?.error ?? "Unauthorized",
    };
  }

  const [existing] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);

  if (existing) {
    return { data: existing };
  }

  const newSettings = {
    id: crypto.randomUUID(),
    userId: user.id,
    baseCurrency: "IDR",
    locale: "id-ID",
  };

  const [created] = await db
    .insert(userSettings)
    .values(newSettings)
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { updatedAt: new Date() },
    })
    .returning();

  return { data: created ?? newSettings };
}

export async function updateUserBaseCurrency(
  baseCurrency: string,
): Promise<{ data?: UserSettings; error?: string }> {
  const { user, error } = await requireAuthUser();
  if (error || !user) return { error: error?.error ?? "Unauthorized" };

  const validConfig = getCurrencyConfig(baseCurrency);
  const targetCurrency = validConfig.code;
  const targetLocale = validConfig.defaultLocale;

  const [updated] = await db
    .insert(userSettings)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      baseCurrency: targetCurrency,
      locale: targetLocale,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        baseCurrency: targetCurrency,
        locale: targetLocale,
        updatedAt: new Date(),
      },
    })
    .returning();

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/payments");
  revalidatePath("/settings");

  return { data: updated };
}

export async function getExchangeRatesAction(): Promise<
  Record<string, number>
> {
  return getExchangeRates();
}
