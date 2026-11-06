import { connection } from "next/server";
import type { ReactNode } from "react";

import { ChatProvider } from "@/components/features/chat";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { AppSidebar } from "@/components/standalone/app-sidebar";
import { ThemeToggler } from "@/components/standalone/theme-toggler";
import { UserNav } from "@/components/standalone/user-nav";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getExchangeRates } from "@/lib/exchange-rates";
import { getUserSettings } from "@/services/features/settings";

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  const [{ data: settings }, rates] = await Promise.all([
    getUserSettings(),
    getExchangeRates(),
  ]);

  return (
    <SidebarProvider>
      <CurrencyProvider
        initialBaseCurrency={settings?.baseCurrency || "IDR"}
        initialRates={rates}
      >
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
      </CurrencyProvider>
    </SidebarProvider>
  );
}
