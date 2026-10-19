import { z } from "zod";

export const aiConfigSchema = z.object({
  provider: z.enum(["openai", "custom", "google", "groq", "openrouter"]),
  model: z.string().min(1, "Model cannot be empty"),
  apiKey: z.string().optional().default(""),
  baseUrl: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        return z.url().safeParse(val.trim()).success;
      },
      { message: "Must be a valid URL" },
    ),
});

export type AIConfigInput = z.infer<typeof aiConfigSchema>;
