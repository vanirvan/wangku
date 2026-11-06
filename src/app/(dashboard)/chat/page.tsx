import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";

import { ChatView } from "@/components/features/chat";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiSettings } from "@/lib/db/schemas";

export const metadata: Metadata = {
  title: "AI Assistant",
  description:
    "Chat with your AI financial assistant to record transactions, manage wallets, and analyze your finances.",
};

async function ChatData() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  let isConfigured = false;
  if (session?.user) {
    const [settings] = await db
      .select({ id: aiSettings.id })
      .from(aiSettings)
      .where(eq(aiSettings.userId, session.user.id));
    isConfigured = Boolean(settings);
  }

  return <ChatView isConfigured={isConfigured} />;
}

export default function ChatPage() {
  return (
    <div className="-m-4 flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
      <Suspense
        fallback={<div className="h-full w-full animate-pulse bg-muted/20" />}
      >
        <ChatData />
      </Suspense>
    </div>
  );
}
