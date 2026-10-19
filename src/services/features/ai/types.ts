export type AIProvider = "openai" | "google" | "groq" | "openrouter" | "custom";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: "gpt-6.1-sol",
  google: "gemini-4-argon",
  groq: "llama-3.3-70b-versatile",
  openrouter: "deepseek/deepseek-v4.1-flash-1017",
  custom: "",
};

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: "openai",
  apiKey: "",
  model: DEFAULT_MODELS.openai,
  baseUrl: "",
};
