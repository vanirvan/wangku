import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ChatProvider } from "@/components/features/chat";
import { ThemeToggler } from "@/components/theme-toggler";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { UserNav } from "@/components/user-nav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      {/*
        ChatProvider wraps the dashboard so active AI streams (and tool executions)
        persist in the background when the user navigates between dashboard pages
        (e.g. checking /transactions or /payments while the assistant is responding).
      */}
      <ChatProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <span className="font-medium text-sm">Dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggler />
              <UserNav />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
        </SidebarInset>
      </ChatProvider>
    </SidebarProvider>
  );
}
