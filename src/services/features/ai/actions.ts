"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { aiSettings } from "@/lib/db/schemas/ai-settings-schema";

import { type AIConfigInput, aiConfigSchema } from "./schema";
import type { AIConfig } from "./types";

async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user ?? null;
}

export async function getAiConfigAction(): Promise<{
  data?: AIConfig | null;
  error?: string;
}> {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const [row] = await db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.userId, user.id));

    if (!row) {
      return { data: null };
    }

    let apiKey = "";
    if (row.encryptedApiKey) {
      try {
        apiKey = decrypt(row.encryptedApiKey);
      } catch {
        apiKey = "";
      }
    }

    return {
      data: {
        provider: row.provider,
        model: row.model,
        baseUrl: row.baseUrl || "",
        apiKey,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to load AI settings";
    return { error: message };
  }
}

export async function saveAiConfigAction(
  input: AIConfigInput,
): Promise<{ success?: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };

  const parsed = aiConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid configuration",
    };
  }

  const { provider, model, baseUrl, apiKey } = parsed.data;
  const sanitizedBaseUrl =
    provider === "custom" && baseUrl?.trim() ? baseUrl.trim() : null;

  try {
    const encryptedKey = apiKey?.trim() ? encrypt(apiKey.trim()) : null;

    await db
      .insert(aiSettings)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        provider,
        model,
        baseUrl: sanitizedBaseUrl,
        encryptedApiKey: encryptedKey,
      })
      .onConflictDoUpdate({
        target: aiSettings.userId,
        set: {
          provider,
          model,
          baseUrl: sanitizedBaseUrl,
          encryptedApiKey: encryptedKey,
          updatedAt: new Date(),
        },
      });

    revalidatePath("/settings");
    return { success: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to save AI settings";
    return { error: message };
  }
}
