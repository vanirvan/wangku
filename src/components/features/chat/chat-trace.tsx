"use client";

import {
  ArrowLeftRight,
  Brain,
  PieChart,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import * as React from "react";

import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

export interface ToolCallPartData {
  id?: string;
  name: string;
  arguments?: string;
  input?: unknown;
  state?: string;
  output?: unknown;
}

export interface ToolResultPartData {
  toolCallId?: string;
  content?: unknown;
  state?: string;
  error?: string;
}

function getToolMeta(name: string, isRunning: boolean, isError: boolean) {
  switch (name) {
    case "get_wallets":
      return {
        title: isError
          ? "Failed to check wallets"
          : isRunning
            ? "Checking wallets and payment methods"
            : "Checked wallets and payment methods",
        icon: <Wallet />,
      };
    case "create_wallet":
      return {
        title: isError
          ? "Failed to create wallet"
          : isRunning
            ? "Creating wallet"
            : "Created wallet",
        icon: <Wallet />,
      };
    case "update_wallet":
      return {
        title: isError
          ? "Failed to update wallet"
          : isRunning
            ? "Updating wallet"
            : "Updated wallet",
        icon: <Wallet />,
      };
    case "delete_wallet":
      return {
        title: isError
          ? "Failed to delete wallet"
          : isRunning
            ? "Deleting wallet"
            : "Deleted wallet",
        icon: <Wallet />,
      };
    case "get_transactions_summary":
      return {
        title: isError
          ? "Failed to calculate financial summary"
          : isRunning
            ? "Calculating financial summary"
            : "Calculated financial summary",
        icon: <PieChart />,
      };
    case "get_recent_transactions":
      return {
        title: isError
          ? "Failed to fetch transactions"
          : isRunning
            ? "Fetching recent transactions"
            : "Fetched recent transactions",
        icon: <ArrowLeftRight />,
      };
    case "get_categories":
      return {
        title: isError
          ? "Failed to retrieve categories"
          : isRunning
            ? "Retrieving categories"
            : "Retrieved categories",
        icon: <Tag />,
      };
    case "create_category":
      return {
        title: isError
          ? "Failed to create category"
          : isRunning
            ? "Creating category"
            : "Created category",
        icon: <Tag />,
      };
    case "search_transactions":
      return {
        title: isError
          ? "Failed to search transactions"
          : isRunning
            ? "Searching transactions"
            : "Searched transactions",
        icon: <Search />,
      };
    case "get_spending_insights":
      return {
        title: isError
          ? "Failed to analyze spending insights"
          : isRunning
            ? "Analyzing spending insights"
            : "Analyzed spending insights",
        icon: <TrendingUp />,
      };
    case "delete_transaction":
      return {
        title: isError
          ? "Failed to delete transaction"
          : isRunning
            ? "Deleting transaction"
            : "Deleted transaction",
        icon: <ArrowLeftRight />,
      };
    case "update_transaction":
      return {
        title: isError
          ? "Failed to update transaction"
          : isRunning
            ? "Updating transaction"
            : "Updated transaction",
        icon: <ArrowLeftRight />,
      };
    case "record_transaction":
      return {
        title: isError
          ? "Failed to record transaction"
          : isRunning
            ? "Recording transaction"
            : "Recorded transaction",
        icon: <ArrowLeftRight />,
      };
    default: {
      const cleanName = name.replace(/_/g, " ");
      return {
        title: isError
          ? `Failed to execute ${cleanName}`
          : isRunning
            ? `Executing ${cleanName}`
            : `Used ${cleanName}`,
        icon: <Wrench />,
      };
    }
  }
}

function safeStringify(val: unknown): string {
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  }
  return JSON.stringify(val, null, 2);
}

function tryParseJson(val?: string) {
  if (!val) return undefined;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

export function ChatToolTrace({
  part,
  result,
  isRunning,
  isError,
}: {
  part: ToolCallPartData;
  result?: ToolResultPartData;
  isRunning: boolean;
  isError: boolean;
}) {
  const status = isError ? "error" : isRunning ? "running" : undefined;
  const meta = getToolMeta(part.name, isRunning, isError);

  const parsedArgs =
    part.input ?? (part.arguments ? tryParseJson(part.arguments) : undefined);
  const outputData = part.output ?? result?.content;

  const hasDetail = Boolean(
    parsedArgs || outputData || (isError && result?.error),
  );

  const line = (
    <TraceLine status={status}>
      <TraceIcon>{meta.icon}</TraceIcon>
      <TraceTitle>{meta.title}</TraceTitle>
      {part.name && (
        <TraceDescription className="font-mono text-[10px]">
          {part.name}
        </TraceDescription>
      )}
    </TraceLine>
  );

  if (!hasDetail) {
    return line;
  }

  return (
    <TraceCollapsible defaultOpen={false}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <div className="space-y-2 py-1 text-xs">
          {parsedArgs && (
            <div>
              <div className="mb-1 font-medium text-foreground text-[11px]">
                Parameters
              </div>
              <pre className="max-h-40 overflow-auto rounded bg-muted/60 p-2 font-mono text-[11px] text-foreground">
                {safeStringify(parsedArgs)}
              </pre>
            </div>
          )}
          {outputData && (
            <div>
              <div className="mb-1 font-medium text-foreground text-[11px]">
                Result
              </div>
              <pre className="max-h-40 overflow-auto rounded bg-muted/60 p-2 font-mono text-[11px] text-foreground">
                {safeStringify(outputData)}
              </pre>
            </div>
          )}
          {isError && result?.error && (
            <div>
              <div className="mb-1 font-medium text-destructive text-[11px]">
                Error
              </div>
              <pre className="max-h-40 overflow-auto rounded bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
                {result.error}
              </pre>
            </div>
          )}
        </div>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

export function ChatThinkingTrace({
  content,
  isRunning,
}: {
  content: string;
  isRunning?: boolean;
}) {
  const [open, setOpen] = React.useState<boolean>();

  return (
    <TraceCollapsible
      open={open ?? isRunning}
      onOpenChange={setOpen}
      defaultOpen={false}
    >
      <TraceCollapsibleTrigger>
        <TraceLine status={isRunning ? "running" : undefined}>
          <TraceIcon>
            <Brain />
          </TraceIcon>
          <TraceTitle>{isRunning ? "Thinking..." : "Reasoning"}</TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <div className="max-h-60 overflow-y-auto whitespace-pre-wrap py-1 font-mono text-xs text-muted-foreground leading-relaxed">
          {content}
        </div>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

export function ChatThinkingIndicator() {
  return (
    <Trace>
      <TraceLine status="running">
        <TraceIcon>
          <Sparkles />
        </TraceIcon>
        <TraceTitle>Thinking...</TraceTitle>
      </TraceLine>
    </Trace>
  );
}

export { Trace };
