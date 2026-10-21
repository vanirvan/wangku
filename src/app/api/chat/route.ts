import {
  type AnyTextAdapter,
  chat,
  toServerSentEventsResponse,
} from "@tanstack/ai";
import { createGeminiChat } from "@tanstack/ai-gemini";
import { createGroqText } from "@tanstack/ai-groq";
import { createOpenaiChatCompletions } from "@tanstack/ai-openai";
import { createOpenRouterText } from "@tanstack/ai-openrouter";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { aiSettings } from "@/lib/db/schemas/ai-settings-schema";
import { getSystemPrompt } from "@/services/features/ai";
import { createAiServerTools } from "@/services/features/ai/tools";
import { getUserSettings } from "@/services/features/settings";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [settings] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.userId, session.user.id));

  if (!settings) {
    return new Response(
      JSON.stringify({
        error:
          "AI not configured. Please configure your AI provider in Settings.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let apiKey = "";
  if (settings.encryptedApiKey) {
    try {
      apiKey = decrypt(settings.encryptedApiKey);
    } catch {
      apiKey = "";
    }
  }

  if (settings.provider !== "custom" && !apiKey) {
    return new Response(
      JSON.stringify({ error: "API Key is missing or invalid." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = await request.json();
  const { messages } = body;

  let adapter: AnyTextAdapter;
  const modelName = settings.model.trim();

  switch (settings.provider) {
    case "openai":
      adapter = createOpenaiChatCompletions(
        modelName as never,
        apiKey,
      ) as unknown as AnyTextAdapter;
      break;

    case "custom":
      adapter = createOpenaiChatCompletions(
        modelName as never,
        apiKey || "not-needed",
        {
          baseURL: settings.baseUrl?.trim().replace(/\/+$/, ""),
        },
      ) as unknown as AnyTextAdapter;
      break;

    case "groq":
      adapter = createGroqText(
        modelName as never,
        apiKey,
      ) as unknown as AnyTextAdapter;
      break;

    case "google":
      adapter = createGeminiChat(
        modelName as never,
        apiKey,
      ) as unknown as AnyTextAdapter;
      break;

    case "openrouter":
      adapter = createOpenRouterText(
        modelName as never,
        apiKey,
      ) as unknown as AnyTextAdapter;
      break;

    default:
      return new Response(
        JSON.stringify({ error: `Unsupported provider: ${settings.provider}` }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
  }

  const [{ data: userPref }, tools] = await Promise.all([
    getUserSettings(),
    Promise.resolve(createAiServerTools(session.user.id)),
  ]);
  const abortController = new AbortController();

  try {
    const stream = chat({
      adapter,
      messages,
      tools,
      systemPrompts: [
        getSystemPrompt({
          baseCurrency: userPref?.baseCurrency || "IDR",
        }),
      ],
      abortController,
    });

    return toServerSentEventsResponse(stream, { abortController });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to run AI chat";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
