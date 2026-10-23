"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AIConfig,
  type AIProvider,
  DEFAULT_AI_CONFIG,
  DEFAULT_MODELS,
  getAiConfigAction,
  saveAiConfigAction,
} from "@/services/features/ai";

const PROVIDERS: { label: string; value: AIProvider }[] = [
  { label: "OpenAI", value: "openai" },
  { label: "OpenAI Compatible", value: "custom" },
  { label: "Google Gemini", value: "google" },
  { label: "Groq", value: "groq" },
  { label: "OpenRouter", value: "openrouter" },
];

const urlSchema = z.url(
  "Must be a valid URL (e.g. https://... or http://localhost:...).",
);

async function testConnection(
  provider: AIProvider,
  apiKey: string,
  baseUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  if (provider !== "custom" && !apiKey.trim()) {
    return { success: false, error: "API Key cannot be empty." };
  }

  if (provider === "custom") {
    const parseResult = urlSchema.safeParse(baseUrl?.trim());
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || "Invalid Base URL.",
      };
    }
  }

  try {
    let url = "";
    const headers: Record<string, string> = {};

    switch (provider) {
      case "openai":
        url = "https://api.openai.com/v1/models";
        headers.Authorization = `Bearer ${apiKey.trim()}`;
        break;
      case "custom": {
        const base = baseUrl?.trim().replace(/\/+$/, "") || "";
        url = `${base}/models`;
        if (apiKey.trim()) {
          headers.Authorization = `Bearer ${apiKey.trim()}`;
        }
        break;
      }
      case "google":
        url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`;
        break;
      case "groq":
        url = "https://api.groq.com/openai/v1/models";
        headers.Authorization = `Bearer ${apiKey.trim()}`;
        break;
      case "openrouter":
        url = "https://openrouter.ai/api/v1/models";
        headers.Authorization = `Bearer ${apiKey.trim()}`;
        break;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (res.ok) {
      return { success: true };
    }

    const text = await res.text();
    let message = `HTTP ${res.status}`;
    try {
      const data = JSON.parse(text);
      message = data.error?.message || data.message || message;
    } catch {
      if (text.length > 0 && text.length < 150) {
        message = text;
      }
    }
    return { success: false, error: message };
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return { success: false, error: "Connection timed out." };
      }
      return { success: false, error: err.message };
    }
    return { success: false, error: "Failed to connect to provider." };
  }
}

export function AiConfigSection() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isTesting, setIsTesting] = useState(false);
  const [isTested, setIsTested] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    async function loadConfig() {
      const res = await getAiConfigAction();
      if (res.data) {
        setConfig(res.data);
        if (
          res.data.apiKey.trim() ||
          (res.data.provider === "custom" && res.data.baseUrl?.trim())
        ) {
          setIsTested(true);
        }
      }
    }

    loadConfig();
  }, []);

  const markDirty = () => {
    setIsTested(false);
    setTestResult(null);
    setSaved(false);
  };

  const handleProviderChange = (provider: AIProvider) => {
    setConfig((prev) => ({
      ...prev,
      provider,
      model: DEFAULT_MODELS[provider] || prev.model,
    }));
    markDirty();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testConnection(
        config.provider,
        config.apiKey,
        config.baseUrl,
      );
      setTestResult(res);
      if (res.success) {
        setIsTested(true);
      }
    } catch (err: unknown) {
      const error =
        err instanceof Error ? err.message : "Connection test failed";
      setTestResult({ success: false, error });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTested || isSaving) return;

    setIsSaving(true);
    setTestResult(null);

    const res = await saveAiConfigAction(config);
    setIsSaving(false);

    if (res.error) {
      setTestResult({ success: false, error: res.error });
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <section id="ai-assistant" className="scroll-mt-8 space-y-4">
      <div className="space-y-1">
        <h2 className="font-semibold text-lg">AI Assistant</h2>
        <p className="text-muted-foreground text-sm">
          Configure your AI provider and credentials for assistant features.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Provider & Model */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select
              items={PROVIDERS}
              value={config.provider}
              onValueChange={(val) => {
                if (val) handleProviderChange(val as AIProvider);
              }}
            >
              <SelectTrigger id="ai-provider" className="w-full">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-model">Model</Label>
            <Input
              id="ai-model"
              type="text"
              value={config.model}
              onChange={(e) => {
                setConfig((prev) => ({ ...prev, model: e.target.value }));
                markDirty();
              }}
              placeholder="e.g. gpt-4o-mini"
            />
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <Label htmlFor="ai-api-key">API Key</Label>
          <div className="relative">
            <Input
              id="ai-api-key"
              type={showKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => {
                setConfig((prev) => ({ ...prev, apiKey: e.target.value }));
                markDirty();
              }}
              placeholder={
                config.provider === "custom"
                  ? "API key (if required by endpoint)"
                  : "Enter your API key"
              }
              className="pr-9"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground"
              aria-label={showKey ? "Hide API key" : "Show API key"}
            >
              {showKey ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Encrypted at rest using{" "}
            <a
              href="https://csrc.nist.gov/publications/detail/sp/800-38d/final"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
            >
              AES-256-GCM
            </a>
            . Decrypted only in-memory to execute your requests.
          </p>
        </div>

        {/* Base URL (Only for OpenAI Compatible) */}
        {config.provider === "custom" && (
          <div className="space-y-1.5">
            <Label htmlFor="ai-base-url">
              Base URL{" "}
              <span className="text-muted-foreground text-xs">
                (Required for custom)
              </span>
            </Label>
            <Input
              id="ai-base-url"
              type="url"
              value={config.baseUrl || ""}
              onChange={(e) => {
                setConfig((prev) => ({ ...prev, baseUrl: e.target.value }));
                markDirty();
              }}
              placeholder="https://api.your-provider.com/v1"
            />
            <p className="text-muted-foreground text-xs">
              Publicly accessible OpenAI-compatible endpoint or gateway (e.g.
              LiteLLM, DeepSeek, Together AI).
            </p>
          </div>
        )}

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
              testResult.success
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-destructive/20 bg-destructive/10 text-destructive"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <div className="space-y-0.5">
              <p className="font-medium">
                {testResult.success
                  ? "Connection verified"
                  : "Connection failed"}
              </p>
              {testResult.error && (
                <p className="opacity-90">{testResult.error}</p>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-end">
          {saved && (
            <span className="flex items-center gap-1 text-emerald-600 text-xs dark:text-emerald-400">
              <Check className="size-3.5" />
              <span>Saved</span>
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              isTesting ||
              (config.provider !== "custom" && !config.apiKey.trim())
            }
            onClick={handleTestConnection}
          >
            {isTesting && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isTesting ? "Testing..." : "Test Connection"}</span>
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={!isTested || isTesting || isSaving}
          >
            {isSaving && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isSaving ? "Saving..." : "Save Changes"}</span>
          </Button>
        </div>
      </form>
    </section>
  );
}
