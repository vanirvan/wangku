"use client";

import type { UIMessage } from "@tanstack/ai-react";
import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "wangku_chat_history";

interface ChatContextValue {
  messages: UIMessage[];
  sendMessage: (content: string) => Promise<void>;
  isLoading: boolean;
  error: Error | undefined;
  stop: () => void;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function sanitizeRestoredMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "assistant") return msg;
    const cleanParts = msg.parts.map((part) => {
      if (part.type === "tool-call") {
        return {
          ...part,
          state: (part.state === "error" ? "error" : "complete") as
            | "complete"
            | "error",
        };
      }
      return part;
    });
    return {
      ...msg,
      parts: cleanParts,
    };
  }) as UIMessage[];
}

function getStoredMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return sanitizeRestoredMessages(parsed);
      }
    }
  } catch (e) {
    console.error("Failed to load chat history from localStorage", e);
  }
  return [];
}

const DEFAULT_CHAT_CONTEXT: ChatContextValue = {
  messages: [],
  sendMessage: async () => {},
  isLoading: false,
  error: undefined,
  stop: () => {},
  clearChat: () => {},
};

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chatKey, setChatKey] = useState(0);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setInitialMessages(getStoredMessages());
    setIsReady(true);
  }, []);

  const handleClear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to clear chat history", e);
    }
    setInitialMessages([]);
    setChatKey((prev) => prev + 1);
  }, []);

  if (!isReady) {
    return (
      <ChatContext.Provider value={DEFAULT_CHAT_CONTEXT}>
        {children}
      </ChatContext.Provider>
    );
  }

  return (
    <ActiveChatInstance
      key={chatKey}
      initialMessages={initialMessages}
      onClear={handleClear}
    >
      {children}
    </ActiveChatInstance>
  );
}

function ActiveChatInstance({
  initialMessages,
  onClear,
  children,
}: {
  initialMessages: UIMessage[];
  onClear: () => void;
  children: ReactNode;
}) {
  const { messages, sendMessage, isLoading, error, stop } = useChat({
    connection: fetchServerSentEvents("/api/chat"),
    initialMessages,
  });

  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.error("Failed to save chat history", e);
      }
    }
  }, [messages]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        sendMessage,
        isLoading,
        error,
        stop,
        clearChat: onClear,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  return ctx ?? DEFAULT_CHAT_CONTEXT;
}
