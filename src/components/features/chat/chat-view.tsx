"use client";

import type { UIMessage } from "@tanstack/ai-react";
import { ArrowUp, Settings, Sparkles, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

import { useChatContext } from "./chat-context";
import {
  ChatThinkingIndicator,
  ChatThinkingTrace,
  ChatToolTrace,
  type ToolCallPartData,
  type ToolResultPartData,
  Trace,
} from "./chat-trace";
import { MarkdownContent } from "./markdown-content";

interface ChatViewProps {
  isConfigured: boolean;
}

export function ChatView({ isConfigured }: ChatViewProps) {
  const { messages, sendMessage, isLoading, error, stop, clearChat } =
    useChatContext();

  const [input, setInput] = useState("");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    sendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toolResultsByCallId = useMemo(() => {
    const map = new Map<string, ToolResultPartData>();
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (part.type === "tool-result" && part.toolCallId) {
          map.set(part.toolCallId, part);
        }
      }
    }
    return map;
  }, [messages]);

  const isCurrentlyExecutingTool = useMemo(() => {
    if (!isLoading || messages.length === 0) return false;
    const lastMsg = messages[messages.length - 1];
    return lastMsg?.parts.some(
      (p) =>
        p.type === "tool-call" &&
        p.state !== "complete" &&
        p.state !== "error" &&
        p.output === undefined &&
        !(p.id && toolResultsByCallId.has(p.id)),
    );
  }, [isLoading, messages, toolResultsByCallId]);

  if (!isConfigured) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center p-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60">
          <Sparkles className="size-6 text-muted-foreground" />
        </div>
        <h2 className="mt-4 font-semibold text-lg">
          AI Assistant Not Configured
        </h2>
        <p className="mt-1.5 max-w-sm text-muted-foreground text-sm">
          Please configure your AI provider and API key in Settings to start
          chatting with your financial assistant.
        </p>
        <Button
          render={<Link href="/settings#ai-assistant" />}
          nativeButton={false}
          size="sm"
          className="mt-5"
        >
          <Settings className="size-4" />
          <span>Go to Settings</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden">
      {/* Top gradient fade from fill to transparent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[80px] bg-linear-to-b from-background to-transparent" />

      {/* Clear Chat Button at top right */}
      {messages.length > 0 && (
        <div className="absolute top-3 right-4 z-20">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-destructive"
            onClick={() => setShowClearDialog(true)}
          >
            <Trash2 className="size-3.5" />
            <span>Clear chat</span>
          </Button>

          <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Clear conversation?</DialogTitle>
                <DialogDescription>
                  This will delete all messages stored in this session from your
                  local storage. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-3">
                <DialogClose
                  render={
                    <Button variant="outline" size="sm">
                      Cancel
                    </Button>
                  }
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    clearChat();
                    setShowClearDialog(false);
                  }}
                >
                  Clear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-8 pb-12">
          {messages.length === 0 ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center text-muted-foreground">
              <div className="flex size-11 items-center justify-center rounded-xl bg-muted/50">
                <Sparkles className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-3 font-medium text-foreground text-sm">
                How can I help with your finances today?
              </p>
              <p className="mt-1 text-xs">
                Try: &quot;What is my total wallet balance?&quot; or &quot;Buy
                coffee with cash&quot;
              </p>
            </div>
          ) : (
            messages.map((message: UIMessage, msgIdx: number) => {
              const isUser = message.role === "user";

              if (isUser) {
                return (
                  <div key={message.id} className="flex justify-end">
                    <Bubble variant="default" align="end">
                      <BubbleContent>
                        {message.parts.map((part) => {
                          if (part.type === "text") {
                            return (
                              <span key={`${message.id}-text`}>
                                {part.content}
                              </span>
                            );
                          }
                          return null;
                        })}
                      </BubbleContent>
                    </Bubble>
                  </div>
                );
              }

              const isLastMessage = msgIdx === messages.length - 1;
              const isPrevSameRole =
                msgIdx > 0 && messages[msgIdx - 1]?.role === message.role;

              // Group consecutive non-text trace items (tool calls, thinking) into a Trace container
              type TraceItem =
                | {
                    type: "tool-call";
                    key: string;
                    part: ToolCallPartData;
                    result?: ToolResultPartData;
                    isRunning: boolean;
                    isError: boolean;
                  }
                | {
                    type: "thinking";
                    key: string;
                    content: string;
                    isRunning: boolean;
                  };

              type Segment =
                | { type: "text"; key: string; content: string }
                | { type: "trace"; key: string; items: TraceItem[] };

              const segments: Segment[] = [];
              let currentTraceGroup: TraceItem[] = [];

              const flushTraceGroup = () => {
                if (currentTraceGroup.length > 0) {
                  segments.push({
                    type: "trace",
                    key: `${message.id}-trace-group-${segments.length}`,
                    items: currentTraceGroup,
                  });
                  currentTraceGroup = [];
                }
              };

              message.parts.forEach((part, partIdx) => {
                const partKey = `${message.id}-part-${partIdx}`;

                if (part.type === "text") {
                  flushTraceGroup();
                  segments.push({
                    type: "text",
                    key: partKey,
                    content: part.content,
                  });
                  return;
                }

                if (part.type === "tool-call") {
                  const hasSubsequentText = message.parts
                    .slice(partIdx + 1)
                    .some(
                      (p) => p.type === "text" && p.content.trim().length > 0,
                    );

                  const result = part.id
                    ? toolResultsByCallId.get(part.id)
                    : undefined;
                  const hasResult =
                    Boolean(result) ||
                    part.state === "complete" ||
                    part.output !== undefined;

                  const isDone =
                    hasResult ||
                    hasSubsequentText ||
                    !isLastMessage ||
                    !isLoading;

                  const isError =
                    part.state === "error" || result?.state === "error";

                  currentTraceGroup.push({
                    type: "tool-call",
                    key: part.id || partKey,
                    part,
                    result,
                    isRunning: !isDone && !isError,
                    isError,
                  });
                  return;
                }

                if (part.type === "thinking") {
                  const isStreaming =
                    isLastMessage &&
                    isLoading &&
                    partIdx === message.parts.length - 1;

                  currentTraceGroup.push({
                    type: "thinking",
                    key: partKey,
                    content: part.content,
                    isRunning: isStreaming,
                  });
                  return;
                }
              });

              flushTraceGroup();

              return (
                <div key={message.id} className="flex flex-col gap-2">
                  {!isPrevSameRole && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Sparkles className="size-3.5 text-primary" />
                      <span className="font-medium text-foreground">
                        Wangku AI
                      </span>
                    </div>
                  )}

                  <div className="space-y-2 pl-5">
                    {segments.map((segment) => {
                      if (segment.type === "text") {
                        return (
                          <MarkdownContent
                            key={segment.key}
                            content={segment.content}
                          />
                        );
                      }

                      return (
                        <Trace key={segment.key} className="my-1">
                          {segment.items.map((item) => {
                            if (item.type === "thinking") {
                              return (
                                <ChatThinkingTrace
                                  key={item.key}
                                  content={item.content}
                                  isRunning={item.isRunning}
                                />
                              );
                            }

                            return (
                              <ChatToolTrace
                                key={item.key}
                                part={item.part}
                                result={item.result}
                                isRunning={item.isRunning}
                                isError={item.isError}
                              />
                            );
                          })}
                        </Trace>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {isLoading && !isCurrentlyExecutingTool && (
            <div className="pl-5">
              <ChatThinkingIndicator />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive text-xs">
              {error.message ||
                "An error occurred while communicating with the AI."}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="relative w-full shrink-0 bg-background">
        <div className="pointer-events-none absolute inset-x-0 bottom-full h-[100px] bg-linear-to-t from-background to-transparent" />
        <div className="mx-auto w-full max-w-5xl px-4 py-3">
          <form onSubmit={handleSubmit}>
            <InputGroup className="h-11 rounded-xl bg-background px-1 shadow-2xs">
              <InputGroupInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Wangku AI or record transactions..."
                className="h-full px-3 text-sm"
              />
              <InputGroupAddon align="inline-end">
                {isLoading ? (
                  <InputGroupButton
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="size-8 rounded-lg"
                    onClick={stop}
                  >
                    <Square className="size-3.5 fill-current" />
                  </InputGroupButton>
                ) : (
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="icon-sm"
                    disabled={!input.trim()}
                    className="size-8 rounded-lg"
                  >
                    <ArrowUp className="size-4" />
                  </InputGroupButton>
                )}
              </InputGroupAddon>
            </InputGroup>
          </form>
          <p className="mt-1.5 text-center text-[0.7rem] text-muted-foreground">
            Wangku AI can record transactions and read wallet balances based on
            your prompts.
          </p>
        </div>
      </div>
    </div>
  );
}
